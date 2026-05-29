/**
 * Claude engine client — uses the existing `@ai-sdk/anthropic` already
 * wired into the codebase (lib/insights/llm-polish.ts, lib/reputation/analyze.ts).
 *
 * Default engine — works out of the box as long as ANTHROPIC_API_KEY is set,
 * no extra dependency required. Returns the assistant's free-text response
 * plus any URLs we can pull from it.
 */

import "server-only";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { EngineCallContext, EngineModule, EngineResult } from "./types";
import { logUsage } from "@/lib/cost-tracker/log";
import { tokenCostUsd, estimateTokens } from "./pricing";

const SYSTEM_PROMPT = `You are a helpful assistant answering a prospective renter's question.
Recommend specific apartment buildings, neighborhoods, and properties when
you can — include the building name and a URL if you know one. Keep your
answer to 2-4 short paragraphs.`;

const MODEL = "claude-haiku-4-5-20251001";

export const claudeEngine: EngineModule = {
  engine: "CLAUDE",
  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  },
  async runPrompt(
    prompt: string,
    ctx?: EngineCallContext,
  ): Promise<EngineResult> {
    if (!this.isConfigured()) {
      return { skipped: true, reason: "ANTHROPIC_API_KEY not configured" };
    }
    const startedAt = Date.now();
    try {
      const { text, usage } = await generateText({
        model: anthropic(MODEL),
        system: SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: 1024,
      });
      const responseText = text ?? "";
      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;
      await logUsage({
        provider: "anthropic",
        endpoint: `${MODEL}/aeo`,
        status: "SUCCESS",
        costUsd: tokenCostUsd(MODEL, inputTokens, outputTokens),
        durationMs: Date.now() - startedAt,
        prospectAuditId: ctx?.prospectAuditId ?? null,
        orgId: ctx?.orgId ?? null,
        propertyId: ctx?.propertyId ?? null,
        meta: { model: MODEL, inputTokens, outputTokens, engine: "CLAUDE" },
      });
      return {
        responseText,
        citedUrls: extractUrls(responseText),
        metadata: { model: MODEL },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[aeo.claude] generateText failed:", message);
      await logUsage({
        provider: "anthropic",
        endpoint: `${MODEL}/aeo`,
        status: "ERROR",
        costUsd: 0,
        durationMs: Date.now() - startedAt,
        prospectAuditId: ctx?.prospectAuditId ?? null,
        orgId: ctx?.orgId ?? null,
        propertyId: ctx?.propertyId ?? null,
        meta: { model: MODEL, engine: "CLAUDE", error: message.slice(0, 200) },
      });
      return { skipped: true, reason: `claude error: ${message}` };
    }
  },
};

function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>()"']+/gi;
  return Array.from(new Set(text.match(re) ?? []));
}
