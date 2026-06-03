/**
 * DataForSEO-backed AEO engine adapters.
 *
 * Same EngineModule contract as ./claude / ./chatgpt / etc., but instead of
 * hitting each provider's native API we go through DataForSEO's AI
 * Optimization LLM Responses endpoint. Single billing relationship, cheaper
 * per call, deterministic mentions parsing.
 *
 * The richer DataForSEO payload (mentions[] + externalId + costUsd) is
 * surfaced through the engine module's `metadata` field under the
 * `dataforseo` key. The orchestrator reads it to build AeoMentionSnapshot
 * rows; downstream code that only looks at `responseText` / `citedUrls`
 * continues to work unchanged.
 */

import "server-only";
import {
  fetchAiLlmResponse,
  type AiLlmMention,
  type AiOptimizationEngine,
} from "@/lib/seo/dataforseo";
import type { EngineCallContext, EngineModule, EngineResult } from "./types";

export interface DataForSeoEngineMetadata {
  /// DataForSEO request id for replay/debug. Null when DataForSEO didn't
  /// return one (older endpoint versions).
  externalId: string | null;
  /// Ordered list of entities the engine mentioned. Kind is always "other"
  /// at this layer — the orchestrator classifies against the org's brand
  /// + competitor list.
  mentions: AiLlmMention[];
  /// Dollar cost of this single call, as reported by DataForSEO.
  costUsd: number;
  /// Engine slug for downstream readers that already squash metadata.
  source: "dataforseo";
  engine: AiOptimizationEngine;
}

function isConfigured(): boolean {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  return Boolean(login && password);
}

function buildEngine(
  engineName: AiOptimizationEngine,
): EngineModule {
  return {
    engine: engineName,
    isConfigured,
    async runPrompt(
      prompt: string,
      ctx?: EngineCallContext,
    ): Promise<EngineResult> {
      if (!isConfigured()) {
        return {
          skipped: true,
          reason: "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not configured",
        };
      }
      // Thread the AEO orchestrator's per-tuple context through to
      // /admin/costs. Surface tag is set inside fetchAiLlmResponse.
      const result = await fetchAiLlmResponse(
        { engine: engineName, prompt },
        {
          orgId: ctx?.orgId ?? null,
          propertyId: ctx?.propertyId ?? null,
          prospectAuditId: ctx?.prospectAuditId ?? null,
        },
      );
      if (!("ok" in result) || !result.ok) {
        // Skipped (env-gated, but we just checked isConfigured) or error.
        // The skipped branch can still fire if DataForSEO env disappears
        // between the check and the call. Either way: surface as engine
        // skip so the orchestrator records nothing for this tuple.
        if ("skipped" in result && result.skipped) {
          return { skipped: true, reason: result.reason };
        }
        const errorResult = result as { ok: false; error: string };
        return {
          skipped: true,
          reason: errorResult.error ?? "dataforseo error",
        };
      }
      const metadata: DataForSeoEngineMetadata = {
        externalId: result.data.externalId,
        mentions: result.data.mentions,
        costUsd: result.costUsd,
        source: "dataforseo",
        engine: engineName,
      };
      return {
        responseText: result.data.responseText,
        citedUrls: result.data.citedUrls,
        metadata: metadata as unknown as Record<string, unknown>,
      };
    },
  };
}

export const dataforseoClaudeEngine = buildEngine("CLAUDE");
export const dataforseoChatgptEngine = buildEngine("CHATGPT");
export const dataforseoPerplexityEngine = buildEngine("PERPLEXITY");
export const dataforseoGeminiEngine = buildEngine("GEMINI");

export const ALL_DATAFORSEO_ENGINES: EngineModule[] = [
  dataforseoClaudeEngine,
  dataforseoChatgptEngine,
  dataforseoPerplexityEngine,
  dataforseoGeminiEngine,
];

/**
 * Type guard for engine metadata produced by the DataForSEO adapter. The
 * orchestrator uses this to decide whether to write an AeoMentionSnapshot
 * row (snapshots are DataForSEO-only in W1).
 */
export function isDataForSeoEngineMetadata(
  meta: unknown,
): meta is DataForSeoEngineMetadata {
  if (!meta || typeof meta !== "object") return false;
  const m = meta as Record<string, unknown>;
  return m.source === "dataforseo" && Array.isArray(m.mentions);
}
