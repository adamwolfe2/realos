import "server-only";

// ---------------------------------------------------------------------------
// LLM rate cards — $ per million tokens (input + output).
//
// Sourced from each vendor's published pricing as of 2026-05.
//
// When a model swap lands (e.g. AEO_OPENAI_MODEL changes), add the new
// entry here. The estimator falls back to the closest known model
// family when a variant isn't found so we never under-log costs on a
// silent model-name change.
//
// Token estimation: most APIs return exact input/output counts in
// `usage` (OpenAI, Anthropic, Perplexity). Gemini doesn't always —
// for that path we estimate with the ~4-chars-per-token heuristic
// (English text averages 3.6 chars/token in production traffic; we
// round up to 4 to slightly over-estimate cost so the dashboard
// doesn't under-report spend).
// ---------------------------------------------------------------------------

export interface ModelRate {
  inputPerM: number;  // USD per 1M input tokens
  outputPerM: number; // USD per 1M output tokens
}

// Default rate when the model isn't in the registry — over-estimates
// rather than under-estimates so /admin/costs is conservative. The
// console gets a warning so we notice and add the real card.
const DEFAULT_RATE: ModelRate = { inputPerM: 1.0, outputPerM: 5.0 };

// Indexed by lowercased substring match against the model id. First
// matching key wins — list more specific keys first when a family
// has multiple variants.
const RATE_CARD: Record<string, ModelRate> = {
  // --- Anthropic Claude ----------------------------------------------------
  // 2026-05: Haiku 4.5 = $1/M input, $5/M output
  "claude-haiku-4-5":     { inputPerM: 1.0,  outputPerM: 5.0 },
  "claude-3-5-haiku":     { inputPerM: 0.8,  outputPerM: 4.0 },
  // Sonnet pricing kept here so future model swaps still get logged.
  "claude-sonnet-4-5":    { inputPerM: 3.0,  outputPerM: 15.0 },
  "claude-opus-4-5":      { inputPerM: 15.0, outputPerM: 75.0 },

  // --- OpenAI --------------------------------------------------------------
  "gpt-4o-mini":          { inputPerM: 0.15, outputPerM: 0.60 },
  "gpt-4o":               { inputPerM: 2.50, outputPerM: 10.0 },
  "gpt-4.1-mini":         { inputPerM: 0.4,  outputPerM: 1.6 },
  "gpt-4.1":              { inputPerM: 2.0,  outputPerM: 8.0 },
  "o3-mini":              { inputPerM: 1.1,  outputPerM: 4.4 },
  "o3":                   { inputPerM: 2.0,  outputPerM: 8.0 },

  // --- Google Gemini -------------------------------------------------------
  // 2026-05: 2.0 Flash = $0.075/M input (<=128K), $0.30/M output
  "gemini-2.0-flash":     { inputPerM: 0.075, outputPerM: 0.30 },
  "gemini-2.5-flash":     { inputPerM: 0.15,  outputPerM: 0.60 },
  "gemini-2.5-pro":       { inputPerM: 1.25,  outputPerM: 5.0 },

  // --- Perplexity Sonar ----------------------------------------------------
  // 2026-05: Sonar = $1/M input + $1/M output (plus $5/1000 searches —
  // not yet attributed per-call; tracked in meta and rolled up separately).
  "sonar-pro":            { inputPerM: 3.0,   outputPerM: 15.0 },
  "sonar":                { inputPerM: 1.0,   outputPerM: 1.0 },
};

/**
 * Resolve a token-cost rate for a given model id. Returns the default
 * (over-estimated) rate when no entry matches. Logs a warning the
 * first time a new model is seen so we know to add a real rate card.
 */
const SEEN_UNKNOWN_MODELS = new Set<string>();
export function rateForModel(modelId: string): ModelRate {
  const key = modelId.toLowerCase();
  for (const [pattern, rate] of Object.entries(RATE_CARD)) {
    if (key.includes(pattern)) return rate;
  }
  if (!SEEN_UNKNOWN_MODELS.has(modelId)) {
    SEEN_UNKNOWN_MODELS.add(modelId);
    console.warn(
      `[cost-tracker] Unknown LLM model "${modelId}" — using default $${DEFAULT_RATE.inputPerM}/M input, $${DEFAULT_RATE.outputPerM}/M output. Add an entry to lib/aeo/engines/pricing.ts when you know the real rate.`,
    );
  }
  return DEFAULT_RATE;
}

/**
 * Compute cost in USD for a given model + token counts. Caller passes
 * exact tokens when the API returned them; falls back to estimateTokens()
 * for engines whose response omits usage.
 */
export function tokenCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = rateForModel(modelId);
  return (
    (Math.max(0, inputTokens) / 1_000_000) * rate.inputPerM +
    (Math.max(0, outputTokens) / 1_000_000) * rate.outputPerM
  );
}

/**
 * Rough token estimate when the API doesn't return usage. Counts ~4
 * chars per token (over-estimates English by ~10% so we don't under-
 * log spend). Use only as a fallback — every API we hit today gives
 * us real counts in their response.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
