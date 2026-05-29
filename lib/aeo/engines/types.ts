/**
 * Shared types for AEO engine clients.
 *
 * Each engine module exports `runPrompt(prompt, ctx): Promise<EngineResult>`.
 * The orchestrator iterates engines × prompts and calls them uniformly.
 *
 * Engines that aren't configured (missing API key) must NOT throw — they
 * return `{ skipped: true }` so the orchestrator can record a NOT_CITED
 * row (or simply skip the engine) without failing the whole scan.
 *
 * Cost-attribution context (2026-05-29): every call carries optional
 * prospectAuditId / orgId / propertyId so the engine wrapper can write
 * a tagged ApiUsage row. /admin/costs reads these tags to attribute
 * spend to the audit / org / property that triggered it.
 */

export interface EngineCallContext {
  prospectAuditId?: string | null;
  orgId?: string | null;
  propertyId?: string | null;
}

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
  runPrompt(prompt: string, ctx?: EngineCallContext): Promise<EngineResult>;
}
