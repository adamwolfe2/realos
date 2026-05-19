/**
 * Neighborhood-claim prompt generator.
 *
 * Given a NeighborhoodPage + the declarative `aiCitations[]` claims an
 * operator wants the page to be cited for, ask Claude to rewrite each
 * claim into 2-3 natural user-style prompts that a prospective renter
 * would actually type into ChatGPT / Perplexity / Claude / Gemini.
 *
 * Output shape per claim:
 *   { claim, prompts: [direct-question, comparison, specific-intent] }
 *
 * These get cached back onto NeighborhoodPage.aiCitations so we don't
 * re-call Claude every scan. The caller is responsible for persisting.
 *
 * Throttling:
 *  - Process one claim at a time (sequential) — Claude is fast enough
 *    and we'd rather not hammer the Anthropic SDK.
 *  - Hard cap of 20 claims per page (matches the editor's max input).
 *  - On any Claude failure we fall back to deterministic templated
 *    prompts so the orchestrator never gets an empty list.
 */

import "server-only";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_CLAIMS = 20;
const PROMPTS_PER_CLAIM_MIN = 2;
const PROMPTS_PER_CLAIM_MAX = 3;

export interface NeighborhoodPromptSeed {
  city: string;
  state: string | null;
  neighborhood: string;
  /** Optional anchor property name — helps Claude phrase the comparison form. */
  propertyName?: string | null;
}

export interface ClaimPromptSet {
  claim: string;
  prompts: string[];
}

/**
 * Read a previously-cached aiCitations JSON value and return the structured
 * { claim, prompts } shape. Tolerates the legacy `string[]` shape stored
 * before this module shipped — those entries come back with prompts: [].
 */
export function parseClaimSets(raw: unknown): ClaimPromptSet[] {
  if (!Array.isArray(raw)) return [];
  const out: ClaimPromptSet[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const claim = entry.trim();
      if (claim) out.push({ claim, prompts: [] });
      continue;
    }
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as { claim?: unknown }).claim === "string"
    ) {
      const claim = ((entry as { claim: string }).claim ?? "").trim();
      const promptsRaw = (entry as { prompts?: unknown }).prompts;
      const prompts = Array.isArray(promptsRaw)
        ? promptsRaw
            .filter((p): p is string => typeof p === "string")
            .map((p) => p.trim())
            .filter(Boolean)
            .slice(0, PROMPTS_PER_CLAIM_MAX)
        : [];
      if (claim) out.push({ claim, prompts });
    }
  }
  return out.slice(0, MAX_CLAIMS);
}

/**
 * Rewrite a single claim into 2-3 natural prompts. Uses Claude when
 * configured; otherwise falls back to templates. Always returns at
 * least 2 prompts.
 */
export async function rewriteClaim(
  claim: string,
  seed: NeighborhoodPromptSeed,
): Promise<string[]> {
  const trimmed = claim.trim();
  if (!trimmed) return [];

  const fallback = templatePrompts(trimmed, seed);

  if (!process.env.ANTHROPIC_API_KEY) {
    return fallback;
  }

  const location = seed.state
    ? `${seed.neighborhood}, ${seed.city}, ${seed.state}`
    : `${seed.neighborhood}, ${seed.city}`;

  const system = `You rewrite declarative real-estate "talking points" into
natural-language search prompts that real prospective renters would type
into AI assistants like ChatGPT, Perplexity, Claude, or Gemini.

Output exactly ${PROMPTS_PER_CLAIM_MAX} prompts as a JSON array of strings.
Each prompt should be a SHORT user-style question or request (under 25
words). Vary the framing:
  1. Direct question: "Where can I find <thing>?"
  2. Comparison: "What are my options for <category> near <area>?"
  3. Specific intent: phrase the claim as a search the user would run.

Do NOT mention the source page, the property name, or your role. Do NOT
prepend numbering. Return ONLY the JSON array, nothing else.`;

  const user = `Neighborhood: ${location}
${seed.propertyName ? `Anchor property: ${seed.propertyName}\n` : ""}Claim to rewrite: ${trimmed}`;

  try {
    const { text } = await generateText({
      model: anthropic(MODEL),
      system,
      prompt: user,
      maxOutputTokens: 400,
    });
    const parsed = parseJsonArray(text);
    const cleaned = parsed
      .map((s) => s.trim())
      .filter((s) => s.length >= 8 && s.length <= 240)
      .slice(0, PROMPTS_PER_CLAIM_MAX);
    if (cleaned.length >= PROMPTS_PER_CLAIM_MIN) return cleaned;
    return fallback;
  } catch (err) {
    console.error(
      "[aeo.prompts-neighborhood] rewriteClaim failed:",
      err instanceof Error ? err.message : err,
    );
    return fallback;
  }
}

/**
 * Rewrite every claim on a page. Sequential to keep Anthropic load gentle.
 * Cached prompts on the input are reused (we don't re-call Claude for a
 * claim that already has >= MIN prompts unless `force` is true).
 */
export async function rewriteAllClaims(
  claims: ClaimPromptSet[],
  seed: NeighborhoodPromptSeed,
  opts?: { force?: boolean },
): Promise<ClaimPromptSet[]> {
  const force = opts?.force ?? false;
  const out: ClaimPromptSet[] = [];
  for (const entry of claims.slice(0, MAX_CLAIMS)) {
    if (!force && entry.prompts.length >= PROMPTS_PER_CLAIM_MIN) {
      out.push(entry);
      continue;
    }
    const prompts = await rewriteClaim(entry.claim, seed);
    out.push({ claim: entry.claim, prompts });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonArray(text: string): string[] {
  if (!text) return [];
  // Strip code fences if Claude wrapped its response.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    const v = JSON.parse(cleaned);
    if (Array.isArray(v)) {
      return v.filter((x): x is string => typeof x === "string");
    }
  } catch {
    // fall through — try to find a bracketed array inside the text.
  }
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const v = JSON.parse(m[0]);
      if (Array.isArray(v)) {
        return v.filter((x): x is string => typeof x === "string");
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

/**
 * Deterministic fallback when Claude is unavailable or returns junk.
 * Produces 3 prompts mirroring the same three framings (direct,
 * comparison, specific-intent) so the orchestrator output stays
 * structurally consistent.
 */
function templatePrompts(
  claim: string,
  seed: NeighborhoodPromptSeed,
): string[] {
  const location = seed.state
    ? `${seed.neighborhood}, ${seed.city}, ${seed.state}`
    : `${seed.neighborhood}, ${seed.city}`;
  const broad = seed.state ? `${seed.city}, ${seed.state}` : seed.city;
  const keyword = extractKeyword(claim);

  return [
    `Where can I find ${keyword || "apartments"} in ${location}?`,
    `What are my options for ${keyword || "rentals"} near ${seed.neighborhood}, ${broad}?`,
    truncate(claim, 200),
  ];
}

function extractKeyword(claim: string): string {
  // Naive extraction — strip the property/proper-noun prefix and a verb
  // like "offers" / "provides" / "features", then grab the first noun phrase.
  const lower = claim.toLowerCase();
  const verbs = [
    " offers ",
    " provides ",
    " features ",
    " includes ",
    " has ",
    " gives ",
  ];
  for (const v of verbs) {
    const i = lower.indexOf(v);
    if (i > 0) {
      const tail = claim.slice(i + v.length).trim();
      // Take first ~6 words.
      return tail.split(/\s+/).slice(0, 6).join(" ").replace(/[.,;:]+$/, "");
    }
  }
  // Fall back to the first 5 words.
  return claim.split(/\s+/).slice(0, 5).join(" ").replace(/[.,;:]+$/, "");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export const NEIGHBORHOOD_PROMPT_LIMITS = {
  MAX_CLAIMS,
  PROMPTS_PER_CLAIM_MIN,
  PROMPTS_PER_CLAIM_MAX,
};
