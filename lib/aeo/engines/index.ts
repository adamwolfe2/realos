/**
 * Engine registry. The orchestrator iterates `ALL_ENGINES` and asks each
 * whether it's configured before running.
 */

import "server-only";
import { claudeEngine } from "./claude";
import { chatgptEngine } from "./chatgpt";
import { perplexityEngine } from "./perplexity";
import { geminiEngine } from "./gemini";
import type { EngineModule } from "./types";

export const ALL_ENGINES: EngineModule[] = [
  claudeEngine,
  chatgptEngine,
  perplexityEngine,
  geminiEngine,
];

export function getEnabledEngines(): EngineModule[] {
  return ALL_ENGINES.filter((e) => e.isConfigured());
}

export type { EngineModule, EngineResult } from "./types";
