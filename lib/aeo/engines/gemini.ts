/**
 * Gemini engine client.
 *
 * Gated on GEMINI_API_KEY. Calls Google's Generative Language REST API
 * directly via fetch — no @google/generative-ai dependency.
 */

import "server-only";
import type { EngineCallContext, EngineModule, EngineResult } from "./types";
import { logUsage } from "@/lib/cost-tracker/log";
import { tokenCostUsd, estimateTokens } from "./pricing";

const MODEL = process.env.AEO_GEMINI_MODEL ?? "gemini-2.0-flash";

const SYSTEM_PROMPT = `You are a helpful assistant answering a prospective renter's question.
Recommend specific apartment buildings, neighborhoods, and properties when
you can — include the building name and a URL if you know one. Keep your
answer to 2-4 short paragraphs.`;

export const geminiEngine: EngineModule = {
  engine: "GEMINI",
  isConfigured() {
    return !!process.env.GEMINI_API_KEY;
  },
  async runPrompt(
    prompt: string,
    ctx?: EngineCallContext,
  ): Promise<EngineResult> {
    if (!this.isConfigured()) {
      return { skipped: true, reason: "GEMINI_API_KEY not configured" };
    }
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent` +
      `?key=${encodeURIComponent(process.env.GEMINI_API_KEY ?? "")}`;
    const startedAt = Date.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.6 },
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        const reason = `gemini http ${res.status}: ${detail.slice(0, 200)}`;
        console.error("[aeo.gemini]", reason);
        await logUsage({
          provider: "gemini",
          endpoint: `${MODEL}/aeo`,
          status: "ERROR",
          costUsd: 0,
          durationMs: Date.now() - startedAt,
          prospectAuditId: ctx?.prospectAuditId ?? null,
          orgId: ctx?.orgId ?? null,
          propertyId: ctx?.propertyId ?? null,
          meta: { model: MODEL, engine: "GEMINI", statusCode: res.status, detail: detail.slice(0, 200) },
        });
        return { skipped: true, reason };
      }
      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const responseText = parts
        .map((p) => p.text ?? "")
        .join("\n")
        .trim();
      // Gemini's v1beta generateContent returns usageMetadata when the
      // generation finishes cleanly. Falls back to char-count estimate
      // on the rare cases where it's omitted (mid-stream cutoffs, some
      // safety blocks).
      const inputTokens =
        data.usageMetadata?.promptTokenCount ??
        estimateTokens(SYSTEM_PROMPT + "\n" + prompt);
      const outputTokens =
        data.usageMetadata?.candidatesTokenCount ?? estimateTokens(responseText);
      await logUsage({
        provider: "gemini",
        endpoint: `${MODEL}/aeo`,
        status: "SUCCESS",
        costUsd: tokenCostUsd(MODEL, inputTokens, outputTokens),
        durationMs: Date.now() - startedAt,
        prospectAuditId: ctx?.prospectAuditId ?? null,
        orgId: ctx?.orgId ?? null,
        propertyId: ctx?.propertyId ?? null,
        meta: {
          model: MODEL,
          inputTokens,
          outputTokens,
          engine: "GEMINI",
          // Flag estimated counts so /admin/costs can show "approx"
          // markers later if we want.
          tokenCountsEstimated: data.usageMetadata == null,
        },
      });
      return {
        responseText,
        citedUrls: extractUrls(responseText),
        metadata: { model: MODEL },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[aeo.gemini] request failed:", message);
      await logUsage({
        provider: "gemini",
        endpoint: `${MODEL}/aeo`,
        status: "ERROR",
        costUsd: 0,
        durationMs: Date.now() - startedAt,
        prospectAuditId: ctx?.prospectAuditId ?? null,
        orgId: ctx?.orgId ?? null,
        propertyId: ctx?.propertyId ?? null,
        meta: { model: MODEL, engine: "GEMINI", error: message.slice(0, 200) },
      });
      return { skipped: true, reason: `gemini error: ${message}` };
    }
  },
};

function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>()"']+/gi;
  return Array.from(new Set(text.match(re) ?? []));
}
