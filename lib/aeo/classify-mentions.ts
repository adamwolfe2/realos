/**
 * Classify entities the engine mentioned as "self" (the brand), "competitor"
 * (some other real-estate / business name), or "other" (anything we can't
 * tell). Used by the orchestrator to compute share-of-voice for the new
 * AeoMentionSnapshot rows.
 *
 * Heuristic only — accept false negatives over false positives. If the
 * classifier can't confidently identify "self", we count nothing toward
 * the brand and let the dashboard show a low share-of-voice. That's the
 * honest read; padding the numerator would mislead operators.
 */

import "server-only";
import type { AiLlmMention } from "@/lib/seo/dataforseo";

export interface BrandTarget {
  name: string | null;
  websiteUrl: string | null;
  /// Optional extra aliases (e.g. shortened building name "The Riverwalk"
  /// for a property called "The Riverwalk Apartments").
  aliases?: string[];
}

export interface ClassifiedMention {
  name: string;
  kind: "self" | "competitor" | "other";
  position: number;
  citedUrl: string | null;
}

export interface ShareOfVoiceResult {
  classified: ClassifiedMention[];
  shareOfVoice: number;
  selfCount: number;
  competitorCount: number;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 0);
}

/**
 * Token-boundary match: the entity mention's token sequence contains the
 * brand's token sequence (or vice versa). Beats raw substring `includes`,
 * which used to false-positive on "Berkeley Riverwalk Apartments" being
 * classified as self for a brand named "Riverwalk".
 *
 * Match rules:
 *  - Identical token arrays match.
 *  - The brand's tokens appear as a contiguous run inside the mention's
 *    tokens (or vice versa for short aliases) — i.e. shared multi-word
 *    prefix or suffix, not a single common token like "apartments".
 *  - Single-token brands match only on exact token equality somewhere
 *    in the mention — never on a containing substring.
 */
function tokenSequenceMatches(
  mentionTokens: string[],
  brandTokens: string[],
): boolean {
  if (brandTokens.length === 0 || mentionTokens.length === 0) return false;
  if (brandTokens.length === 1) {
    return mentionTokens.includes(brandTokens[0]);
  }
  // Look for brandTokens as a contiguous slice of mentionTokens.
  const limit = mentionTokens.length - brandTokens.length;
  for (let i = 0; i <= limit; i++) {
    let match = true;
    for (let j = 0; j < brandTokens.length; j++) {
      if (mentionTokens[i + j] !== brandTokens[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  // Reverse direction: short alias inside a long brand. Only meaningful
  // when mentionTokens are shorter than brandTokens (e.g. alias "TGCC"
  // mentioned, brand "telegraph commons" — handled via aliases anyway,
  // but keep the symmetric check for robustness).
  if (mentionTokens.length < brandTokens.length) {
    const inner = mentionTokens.join(" ");
    const outer = brandTokens.join(" ");
    return outer.includes(inner);
  }
  return false;
}

function hostFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function buildSelfMatchers(target: BrandTarget): {
  /// Each entry is the tokenized form of one brand-name candidate
  /// (target.name or one of target.aliases). Matching is token-boundary
  /// aware via `tokenSequenceMatches` so "Riverwalk" doesn't classify
  /// "Berkeley Riverwalk Apartments" as self.
  nameTokenLists: string[][];
  hosts: string[];
} {
  const nameTokenLists: string[][] = [];
  const candidates = [target.name, ...(target.aliases ?? [])].filter(
    (s): s is string => Boolean(s && s.trim().length > 0),
  );
  for (const c of candidates) {
    const tokens = tokenize(c);
    if (tokens.length === 0) continue;
    // Discard very short single-token aliases like "the" or "a" that
    // would match almost every mention. Token boundary protects against
    // longer collisions; here we just guard against pure noise.
    if (tokens.length === 1 && tokens[0].length < 3) continue;
    nameTokenLists.push(tokens);
  }
  const host = hostFromUrl(target.websiteUrl);
  const hosts = host ? [host] : [];
  return { nameTokenLists, hosts };
}

function isSelfMention(
  mention: AiLlmMention,
  matchers: { nameTokenLists: string[][]; hosts: string[] },
): boolean {
  const mentionTokens = tokenize(mention.name);
  if (
    matchers.nameTokenLists.some((brandTokens) =>
      tokenSequenceMatches(mentionTokens, brandTokens),
    )
  ) {
    return true;
  }
  if (mention.citedUrl) {
    const host = hostFromUrl(mention.citedUrl);
    if (host && matchers.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return true;
    }
  }
  return false;
}

/**
 * Classify each mention against the brand target and compute share-of-voice.
 * Empty input returns shareOfVoice 0 (no signal yet).
 *
 * Pure function. No DB, no IO.
 */
export function classifyMentions(
  mentions: AiLlmMention[],
  target: BrandTarget,
): ShareOfVoiceResult {
  if (mentions.length === 0) {
    return {
      classified: [],
      shareOfVoice: 0,
      selfCount: 0,
      competitorCount: 0,
    };
  }
  const matchers = buildSelfMatchers(target);
  const hasIdentity =
    matchers.nameTokenLists.length > 0 || matchers.hosts.length > 0;

  const classified: ClassifiedMention[] = mentions.map((m) => {
    const isSelf = hasIdentity ? isSelfMention(m, matchers) : false;
    // Without identity, everything is "other" — we can't make a competitor
    // claim either. With identity, non-self competing brand mentions
    // count as competitors so the SoV denominator is meaningful.
    const kind: ClassifiedMention["kind"] = isSelf
      ? "self"
      : hasIdentity
        ? "competitor"
        : "other";
    return {
      name: m.name,
      kind,
      position: m.position,
      citedUrl: m.citedUrl,
    };
  });

  const selfCount = classified.filter((c) => c.kind === "self").length;
  const competitorCount = classified.filter(
    (c) => c.kind === "competitor",
  ).length;
  const denom = selfCount + competitorCount;
  const shareOfVoice = denom > 0 ? selfCount / denom : 0;

  return { classified, shareOfVoice, selfCount, competitorCount };
}
