/**
 * ChatGPT engine client.
 *
 * Gated on OPENAI_API_KEY. We call the OpenAI Chat Completions REST API
 * directly via fetch instead of bundling the `openai` SDK so this feature
 * doesn't add a new dependency. Same pattern used elsewhere in the codebase.
 */

import "server-only";
import type { EngineCallContext, EngineModule, EngineResult } from "./types";
import { logUsage } from "@/lib/cost-tracker/log";
import { tokenCostUsd, estimateTokens } from "./pricing";

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
  async runPrompt(
    prompt: string,
    ctx?: EngineCallContext,
  ): Promise<EngineResult> {
    if (!this.isConfigured()) {
      return { skipped: true, reason: "OPENAI_API_KEY not configured" };
    }
    const startedAt = Date.now();
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
        await logUsage({
          provider: "openai",
          endpoint: `${MODEL}/aeo`,
          status: "ERROR",
          costUsd: 0,
          durationMs: Date.now() - startedAt,
          prospectAuditId: ctx?.prospectAuditId ?? null,
          orgId: ctx?.orgId ?? null,
          propertyId: ctx?.propertyId ?? null,
          meta: { model: MODEL, engine: "CHATGPT", statusCode: res.status, detail: detail.slice(0, 200) },
        });
        return { skipped: true, reason };
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const responseText =
        data.choices?.[0]?.message?.content?.trim() ?? "";
      // OpenAI returns actual prompt + completion token counts. Fall
      // back to estimates only if the response somehow omits usage
      // (shouldn't happen on the chat-completions endpoint, but the
      // type is optional so we guard).
      const inputTokens =
        data.usage?.prompt_tokens ?? estimateTokens(SYSTEM_PROMPT + "\n" + prompt);
      const outputTokens =
        data.usage?.completion_tokens ?? estimateTokens(responseText);
      await logUsage({
        provider: "openai",
        endpoint: `${MODEL}/aeo`,
        status: "SUCCESS",
        costUsd: tokenCostUsd(MODEL, inputTokens, outputTokens),
        durationMs: Date.now() - startedAt,
        prospectAuditId: ctx?.prospectAuditId ?? null,
        orgId: ctx?.orgId ?? null,
        propertyId: ctx?.propertyId ?? null,
        meta: { model: MODEL, inputTokens, outputTokens, engine: "CHATGPT" },
      });
      return {
        responseText,
        citedUrls: extractUrls(responseText),
        metadata: { model: MODEL },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[aeo.chatgpt] request failed:", message);
      await logUsage({
        provider: "openai",
        endpoint: `${MODEL}/aeo`,
        status: "ERROR",
        costUsd: 0,
        durationMs: Date.now() - startedAt,
        prospectAuditId: ctx?.prospectAuditId ?? null,
        orgId: ctx?.orgId ?? null,
        propertyId: ctx?.propertyId ?? null,
        meta: { model: MODEL, engine: "CHATGPT", error: message.slice(0, 200) },
      });
      return { skipped: true, reason: `chatgpt error: ${message}` };
    }
  },
};

function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>()"']+/gi;
  return Array.from(new Set(text.match(re) ?? []));
}
