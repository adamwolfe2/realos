/**
 * Perplexity engine client.
 *
 * Gated on PERPLEXITY_API_KEY. We call the Perplexity Chat Completions
 * REST API directly via fetch (Sonar models) — they include citation
 * URLs as a top-level `citations` array in the response, which we
 * surface to the parser as `citedUrls`.
 */

import "server-only";
import type { EngineModule, EngineResult } from "./types";

const ENDPOINT = "https://api.perplexity.ai/chat/completions";
const MODEL = process.env.AEO_PERPLEXITY_MODEL ?? "sonar";

const SYSTEM_PROMPT = `You are a helpful assistant answering a prospective renter's question.
Recommend specific apartment buildings, neighborhoods, and properties when
you can — include the building name and a URL if you know one. Keep your
answer to 2-4 short paragraphs.`;

export const perplexityEngine: EngineModule = {
  engine: "PERPLEXITY",
  isConfigured() {
    return !!process.env.PERPLEXITY_API_KEY;
  },
  async runPrompt(prompt: string): Promise<EngineResult> {
    if (!this.isConfigured()) {
      return { skipped: true, reason: "PERPLEXITY_API_KEY not configured" };
    }
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
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
        const reason = `perplexity http ${res.status}: ${detail.slice(0, 200)}`;
        console.error("[aeo.perplexity]", reason);
        return { skipped: true, reason };
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        citations?: string[];
      };
      const responseText =
        data.choices?.[0]?.message?.content?.trim() ?? "";
      const apiCitations = Array.isArray(data.citations) ? data.citations : [];
      const inlineUrls = extractUrls(responseText);
      const citedUrls = Array.from(new Set([...apiCitations, ...inlineUrls]));
      return {
        responseText,
        citedUrls,
        metadata: { model: MODEL, apiCitations: apiCitations.length },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[aeo.perplexity] request failed:", message);
      return { skipped: true, reason: `perplexity error: ${message}` };
    }
  },
};

function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>()"']+/gi;
  return Array.from(new Set(text.match(re) ?? []));
}
