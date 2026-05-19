/**
 * ChatGPT engine client.
 *
 * Gated on OPENAI_API_KEY. We call the OpenAI Chat Completions REST API
 * directly via fetch instead of bundling the `openai` SDK so this feature
 * doesn't add a new dependency. Same pattern used elsewhere in the codebase.
 */

import "server-only";
import type { EngineModule, EngineResult } from "./types";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.AEO_OPENAI_MODEL ?? "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a helpful assistant answering a prospective renter's question.
Recommend specific apartment buildings, neighborhoods, and properties when
you can — include the building name and a URL if you know one. Keep your
answer to 2-4 short paragraphs.`;

export const chatgptEngine: EngineModule = {
  engine: "CHATGPT",
  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  },
  async runPrompt(prompt: string): Promise<EngineResult> {
    if (!this.isConfigured()) {
      return { skipped: true, reason: "OPENAI_API_KEY not configured" };
    }
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          max_tokens: 1024,
          temperature: 0.6,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        const reason = `chatgpt http ${res.status}: ${detail.slice(0, 200)}`;
        console.error("[aeo.chatgpt]", reason);
        return { skipped: true, reason };
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const responseText =
        data.choices?.[0]?.message?.content?.trim() ?? "";
      return {
        responseText,
        citedUrls: extractUrls(responseText),
        metadata: { model: MODEL },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[aeo.chatgpt] request failed:", message);
      return { skipped: true, reason: `chatgpt error: ${message}` };
    }
  },
};

function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>()"']+/gi;
  return Array.from(new Set(text.match(re) ?? []));
}
