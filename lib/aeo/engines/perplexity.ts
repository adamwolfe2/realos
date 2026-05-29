/**
 * Perplexity engine client.
 *
 * Gated on PERPLEXITY_API_KEY. We call the Perplexity Chat Completions
 * REST API directly via fetch (Sonar models) — they include citation
 * URLs as a top-level `citations` array in the response, which we
 * surface to the parser as `citedUrls`.
 */

import "server-only";
import type { EngineCallContext, EngineModule, EngineResult } from "./types";
import { logUsage } from "@/lib/cost-tracker/log";
import { tokenCostUsd, estimateTokens } from "./pricing";

// Perplexity's Sonar tier bills a $5/1000 fee per search call ON TOP
// of token costs (their "premium search" multiplier). One Sonar request
// = one search, so we add a flat $0.005 to every successful call to
// match the dashboard against the real invoice. If/when we move to a
// non-Sonar model that doesn't have this fee, drop this constant.
const PERPLEXITY_SEARCH_FEE_USD = 0.005;

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
  async runPrompt(
    prompt: string,
    ctx?: EngineCallContext,
  ): Promise<EngineResult> {
    if (!this.isConfigured()) {
      return { skipped: true, reason: "PERPLEXITY_API_KEY not configured" };
    }
    const startedAt = Date.now();
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
        await logUsage({
          provider: "perplexity",
          endpoint: `${MODEL}/aeo`,
          status: "ERROR",
          costUsd: 0,
          durationMs: Date.now() - startedAt,
          prospectAuditId: ctx?.prospectAuditId ?? null,
          orgId: ctx?.orgId ?? null,
          propertyId: ctx?.propertyId ?? null,
          meta: { model: MODEL, engine: "PERPLEXITY", statusCode: res.status, detail: detail.slice(0, 200) },
        });
        return { skipped: true, reason };
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        citations?: string[];
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const responseText =
        data.choices?.[0]?.message?.content?.trim() ?? "";
      const apiCitations = Array.isArray(data.citations) ? data.citations : [];
      const inlineUrls = extractUrls(responseText);
      const citedUrls = Array.from(new Set([...apiCitations, ...inlineUrls]));
      // Perplexity Sonar returns OpenAI-compatible usage. Cost = token
      // cost + flat search fee (Sonar tier ships search results which
      // they bill separately at $5/1000 calls).
      const inputTokens =
        data.usage?.prompt_tokens ?? estimateTokens(SYSTEM_PROMPT + "\n" + prompt);
      const outputTokens =
        data.usage?.completion_tokens ?? estimateTokens(responseText);
      const tokenCost = tokenCostUsd(MODEL, inputTokens, outputTokens);
      const totalCost = tokenCost + PERPLEXITY_SEARCH_FEE_USD;
      await logUsage({
        provider: "perplexity",
        endpoint: `${MODEL}/aeo`,
        status: "SUCCESS",
        costUsd: totalCost,
        durationMs: Date.now() - startedAt,
        prospectAuditId: ctx?.prospectAuditId ?? null,
        orgId: ctx?.orgId ?? null,
        propertyId: ctx?.propertyId ?? null,
        meta: {
          model: MODEL,
          inputTokens,
          outputTokens,
          engine: "PERPLEXITY",
          tokenCostUsd: tokenCost,
          searchFeeUsd: PERPLEXITY_SEARCH_FEE_USD,
          apiCitations: apiCitations.length,
        },
      });
      return {
        responseText,
        citedUrls,
        metadata: { model: MODEL, apiCitations: apiCitations.length },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[aeo.perplexity] request failed:", message);
      await logUsage({
        provider: "perplexity",
        endpoint: `${MODEL}/aeo`,
        status: "ERROR",
        costUsd: 0,
        durationMs: Date.now() - startedAt,
        prospectAuditId: ctx?.prospectAuditId ?? null,
        orgId: ctx?.orgId ?? null,
        propertyId: ctx?.propertyId ?? null,
        meta: { model: MODEL, engine: "PERPLEXITY", error: message.slice(0, 200) },
      });
      return { skipped: true, reason: `perplexity error: ${message}` };
    }
  },
};

function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>()"']+/gi;
  return Array.from(new Set(text.match(re) ?? []));
}
