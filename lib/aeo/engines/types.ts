/**
 * Shared types for AEO engine clients.
 *
 * Each engine module exports `runPrompt(prompt: string): Promise<EngineResult>`.
 * The orchestrator iterates engines × prompts and calls them uniformly.
 *
 * Engines that aren't configured (missing API key) must NOT throw — they
 * return `{ skipped: true }` so the orchestrator can record a NOT_CITED
 * row (or simply skip the engine) without failing the whole scan.
 */

export interface EngineSuccess {
  skipped?: false;
  responseText: string;
  citedUrls: string[];
  metadata?: Record<string, unknown>;
}

export interface EngineSkipped {
  skipped: true;
  reason: string;
}

export type EngineResult = EngineSuccess | EngineSkipped;

export interface EngineModule {
  /** Engine name — matches AeoEngine enum. */
  engine: "CLAUDE" | "CHATGPT" | "PERPLEXITY" | "GEMINI";
  /** Returns true if the engine is configured (API key present). */
  isConfigured(): boolean;
  runPrompt(prompt: string): Promise<EngineResult>;
}
