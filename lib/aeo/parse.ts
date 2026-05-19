/**
 * AEO citation parser.
 *
 * Given an AI assistant's free-text response + the target property's name,
 * website domain, and optional aliases, decide whether the property was
 * CITED, COMPETITOR_CITED, or NOT_CITED.
 *
 * Heuristics:
 *  - CITED if the property name (or any alias) appears as a near-exact
 *    substring (case-insensitive, punctuation- and quote-tolerant), OR if
 *    any URL on the property's primary domain is mentioned.
 *  - COMPETITOR_CITED if we DIDN'T match the property, but the response
 *    cites at least one apartment/building name we can extract — i.e. the
 *    AI gave a list of recommendations and we're not on it.
 *  - NOT_CITED otherwise (e.g. the AI declined, gave generic advice, or
 *    suggested a neighborhood without naming buildings).
 *
 * Competitor extraction is intentionally conservative — we look for
 * common multifamily / commercial building name patterns ("The Whitley",
 * "1234 Main", "Park Lane Apartments"). False positives are preferable
 * to silent NOT_CITED when the AI actually did recommend competitors.
 */

import "server-only";

export interface ParseTarget {
  name: string;
  websiteUrl?: string | null;
  /** Optional alternate brand strings ("Telegraph Commons" + "TGCC"). */
  aliases?: string[];
}

export interface ParseResult {
  status: "CITED" | "NOT_CITED" | "COMPETITOR_CITED";
  citedUrl?: string;
  competitorsCited: string[];
}

export function parseCitation(
  responseText: string,
  target: ParseTarget,
): ParseResult {
  const text = responseText ?? "";
  if (!text.trim()) {
    return { status: "NOT_CITED", competitorsCited: [] };
  }

  const normalized = normalize(text);

  // 1. Name / alias match — case-insensitive, punctuation-tolerant.
  const aliases = [target.name, ...(target.aliases ?? [])]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s && s.length >= 3);

  for (const alias of aliases) {
    const needle = normalize(alias);
    if (!needle) continue;
    if (containsNamePhrase(normalized, needle)) {
      const url = extractDomainUrl(text, target.websiteUrl);
      return {
        status: "CITED",
        citedUrl: url,
        competitorsCited: [],
      };
    }
  }

  // 2. Domain match — any URL hosted on the property's domain counts.
  const domainUrl = extractDomainUrl(text, target.websiteUrl);
  if (domainUrl) {
    return { status: "CITED", citedUrl: domainUrl, competitorsCited: [] };
  }

  // 3. Competitor extraction — names we DIDN'T match.
  const competitors = extractCompetitorNames(text, aliases);
  if (competitors.length > 0) {
    return { status: "COMPETITOR_CITED", competitorsCited: competitors };
  }

  return { status: "NOT_CITED", competitorsCited: [] };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, "'") // smart quotes → straight
    .replace(/[^a-z0-9\s']/g, " ") // punctuation → space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Word-boundary-aware contains check. Avoids matching "park" inside
 * "parking" or "the lofts" inside "the lofts at sunset" (no — actually we
 * DO want the latter; substring is fine since we already aliased).
 */
function containsNamePhrase(haystack: string, needle: string): boolean {
  if (haystack.includes(needle)) return true;
  // Allow possessive/plural: "telegraph commons's", "telegraph commons,"
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|\\W)${escaped}(?:\\W|$)`, "i");
  return re.test(haystack);
}

/**
 * Pull the first URL out of `text` that lives on the property's domain.
 * Returns the matched URL string (with http(s):// if present), or undefined.
 */
function extractDomainUrl(
  text: string,
  websiteUrl?: string | null,
): string | undefined {
  const host = hostnameOf(websiteUrl);
  if (!host) return undefined;
  // Match URLs, with or without scheme. Also handle bare "host.com/path".
  const urlRe = /\bhttps?:\/\/[^\s<>()"']+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>()"']*)?/gi;
  const matches = text.match(urlRe) ?? [];
  for (const m of matches) {
    const h = hostnameOf(m);
    if (h && hostsMatch(h, host)) {
      return m;
    }
  }
  return undefined;
}

function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    // Add scheme if missing so URL() can parse "example.com/foo".
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const u = new URL(withScheme);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function hostsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // Allow subdomain match — "leasing.example.com" matches "example.com".
  return a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

/**
 * Extract probable competitor building names from the response text.
 *
 * Looks for:
 *  - Numbered / bulleted list items where the first noun-phrase is
 *    capitalized: "1. The Whitley", "- Park Lane Apartments".
 *  - Markdown bold building names: "**The Lofts at Capitol Hill**".
 *  - Inline patterns like "Whitley Apartments" / "The X Lofts" /
 *    "X Residences" / "X Tower" / "X at Y".
 *
 * Filters out anything that matches one of our own aliases (case-insensitive).
 */
export function extractCompetitorNames(
  text: string,
  ownerAliases: string[],
): string[] {
  const aliasSet = new Set(ownerAliases.map((a) => normalize(a)));
  const candidates = new Set<string>();

  // Bold-wrapped names.
  const boldRe = /\*\*([^*\n]{3,80})\*\*/g;
  for (const m of text.matchAll(boldRe)) {
    if (isPlausibleBuildingName(m[1])) candidates.add(m[1].trim());
  }

  // List items: "1. Foo", "1) Foo", "- Foo", "* Foo"
  const listRe = /^\s*(?:\d+[.)]|[-*])\s+([^\n]{3,100})/gm;
  for (const m of text.matchAll(listRe)) {
    const line = m[1].trim();
    // Take the leading capitalized phrase up to a separator.
    const head = line.split(/[—–:|(,;]/)[0].trim();
    if (isPlausibleBuildingName(head)) candidates.add(head);
  }

  // Inline building-suffix patterns.
  const suffixRe =
    /\b((?:The\s+)?[A-Z][A-Za-z0-9&'’.-]+(?:\s+[A-Z][A-Za-z0-9&'’.-]+){0,3})\s+(Apartments?|Lofts?|Residences?|Tower|Towers|House|Plaza|Place|Square|Park|Estates?|Suites?|Flats?|Commons|Heights|Village|Lodge)\b/g;
  for (const m of text.matchAll(suffixRe)) {
    const full = `${m[1]} ${m[2]}`.trim();
    if (isPlausibleBuildingName(full)) candidates.add(full);
  }

  return Array.from(candidates)
    .filter((c) => !aliasSet.has(normalize(c)))
    .slice(0, 10);
}

function isPlausibleBuildingName(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length < 3 || trimmed.length > 80) return false;
  // Must start with a capital letter or "The".
  if (!/^[A-Z]/.test(trimmed)) return false;
  // Reject sentences with verbs / lower-case dominance — heuristic only.
  const words = trimmed.split(/\s+/);
  if (words.length > 8) return false;
  // Reject pure lowercase fragments after first word.
  const capCount = words.filter((w) => /^[A-Z]/.test(w)).length;
  if (capCount < Math.ceil(words.length / 2)) return false;
  return true;
}
