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
  nameTokens: string[];
  hosts: string[];
} {
  const nameTokens: string[] = [];
  const candidates = [target.name, ...(target.aliases ?? [])].filter(
    (s): s is string => Boolean(s && s.trim().length > 0),
  );
  for (const c of candidates) {
    const norm = normalize(c);
    if (norm.length >= 3) nameTokens.push(norm);
  }
  const host = hostFromUrl(target.websiteUrl);
  const hosts = host ? [host] : [];
  return { nameTokens, hosts };
}

function isSelfMention(
  mention: AiLlmMention,
  matchers: { nameTokens: string[]; hosts: string[] },
): boolean {
  const name = normalize(mention.name);
  if (
    matchers.nameTokens.some(
      (token) => name === token || name.includes(token) || token.includes(name),
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
    matchers.nameTokens.length > 0 || matchers.hosts.length > 0;

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
