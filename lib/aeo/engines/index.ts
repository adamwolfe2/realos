/**
 * Engine registry. The orchestrator iterates `ALL_ENGINES` and asks each
 * whether it's configured before running.
 *
 * Source selection via `AEO_ENGINE_SOURCE`:
 *   - "dataforseo" → all 4 engines proxied through DataForSEO AI Optimization
 *     (single billing, cheaper, deterministic mentions)
 *   - "direct" (default) → direct provider APIs (legacy path, still wired
 *     because we want a one-keystroke rollback if DataForSEO has an outage)
 */

import "server-only";
import { claudeEngine } from "./claude";
import { chatgptEngine } from "./chatgpt";
import { perplexityEngine } from "./perplexity";
import { geminiEngine } from "./gemini";
import {
  ALL_DATAFORSEO_ENGINES,
  isDataForSeoEngineMetadata,
} from "./dataforseo";
import type { EngineModule } from "./types";

export type AeoEngineSource = "direct" | "dataforseo";

export function resolveEngineSource(): AeoEngineSource {
  const raw = process.env.AEO_ENGINE_SOURCE?.toLowerCase().trim();
  return raw === "dataforseo" ? "dataforseo" : "direct";
}

const DIRECT_ENGINES: EngineModule[] = [
  claudeEngine,
  chatgptEngine,
  perplexityEngine,
  geminiEngine,
];

export const ALL_ENGINES: EngineModule[] =
  resolveEngineSource() === "dataforseo"
    ? ALL_DATAFORSEO_ENGINES
    : DIRECT_ENGINES;

export function getEnabledEngines(): EngineModule[] {
  // Re-resolve at call time so a runtime env flip (e.g. inside a test)
  // takes effect without needing a module reload.
  const source = resolveEngineSource();
  const pool = source === "dataforseo" ? ALL_DATAFORSEO_ENGINES : DIRECT_ENGINES;
  return pool.filter((e) => e.isConfigured());
}

export { isDataForSeoEngineMetadata };
export type { EngineModule, EngineResult } from "./types";
export type { DataForSeoEngineMetadata } from "./dataforseo";
