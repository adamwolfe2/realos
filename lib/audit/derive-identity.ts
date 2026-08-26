/**
 * Who are we actually auditing? (Slice 1 of
 * .claude/specs/2026-08-26-aeo-report-generator-handoff.md.)
 *
 * Every prospect fan-out — the engine prompts, the reputation mention
 * scan, the Google AI Overview query — is keyed off one name. When the
 * prospect types it, we use it. When they don't (the /audit quiz posts a
 * URL and nothing else, and that is the highest-traffic entry point), the
 * old fallback split the domain string against a 24-word vocabulary:
 * `theeddyresidences.com` came out "Theeddy Residences",
 * `thewarwickhillcrest.com` came out "Thewarwickhillcrest", and the report
 * asked four engines about a company of that name.
 *
 * The homepage already tells us. It carries a schema.org `name`, an
 * `og:site_name`, and a `<title>`. This reads them in that order and keeps
 * `brandNameFromDomain` as the floor.
 *
 * ponytail: re-parses the ld+json blocks out of `crawl.html` rather than
 * threading parsed nodes through SiteCrawlResult. It is one more pass over
 * a capped string on a path that already spends seconds in network I/O,
 * and it keeps the crawl's persisted shape unchanged. If a third reader
 * ever needs the nodes, parse once in the crawl and pass them in.
 */

import type { SiteCrawlResult } from "@/lib/audit/site-crawl";
import { brandNameFromDomain } from "@/lib/audit/reputation-prospect";

export type NameSource = "supplied" | "schema" | "og" | "title" | "domain";

export interface ResolvedIdentity {
  /** The name every fan-out should ask about. Never empty. */
  name: string;
  nameSource: NameSource;
  /** Final URL after redirects, when the crawl got that far. */
  resolvedUrl: string | null;
  /**
   * How much we'd bet on this name. `low` means we fell back to the domain
   * splitter, which is the case worth confirming with the human (slice 6).
   */
  confidence: "high" | "medium" | "low";
}

/** schema.org types whose `name` is the property/operator, not a page. */
const NAME_BEARING_TYPES = [
  "apartmentcomplex",
  "residence",
  "singlefamilyresidence",
  "seniorlivingresidence",
  "localbusiness",
  "realestateagent",
  "organization",
  "lodgingbusiness",
  "place",
  "hotel",
  "selfstorage",
];

/**
 * Separators sites use to bolt a tagline onto the title. Everything from
 * the first one on is marketing, not the name.
 */
const TITLE_SEPARATORS = /\s+[|｜–—·•>]\s+|\s+-\s+/;

/** Junk a title leaves behind once the tagline is gone. */
const TITLE_NOISE =
  /^(home|homepage|welcome|welcome to|official site|official website)\b[\s:,-]*/i;

function cleanTitleName(title: string | null): string | null {
  if (!title) return null;
  // Take the first segment — "Telegraph Commons | Student Housing Near UC
  // Berkeley Campus" keeps only the name. A segment that is nothing but
  // boilerplate ("Home | The Eddy Residences") is skipped; anything else
  // is judged on its own, because a later segment is as likely to be a
  // tagline as a name and we would rather fall back to the domain and
  // flag low confidence than invent "Luxury Living Redefined".
  const segments = title.split(TITLE_SEPARATORS).map((seg) => seg.trim());
  let stripped = "";
  for (const segment of segments) {
    stripped = segment.replace(TITLE_NOISE, "").trim();
    if (stripped) break;
  }
  // "Apartments for Rent in Hillcrest" is a description, not a name. A
  // leading category word means the site put its tagline first; the name
  // is not recoverable from this segment.
  if (/^(apartments?|homes?|houses?|condos?|lofts?|rentals?)\b/i.test(stripped)) {
    return null;
  }
  // Drop a trailing ", City, ST" or " in City, ST".
  const withoutPlace = stripped
    .replace(/\s*[,|-]?\s+in\s+[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,2}(?:,\s*[A-Z]{2})?$/, "")
    .replace(/,\s*[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,2}(?:,\s*[A-Z]{2})?$/, "")
    .trim();
  const name = withoutPlace || stripped;
  if (name.length < 2 || name.length > 80) return null;
  // A whole sentence is a tagline that used no separator.
  if (name.split(/\s+/).length > 7) return null;
  return name;
}

function metaContent(html: string, property: string): string | null {
  // Both attribute orders occur in the wild.
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${property}["'][^>]*content\\s*=\\s*["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*(?:property|name)\\s*=\\s*["']${property}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    const value = m?.[1]?.trim();
    if (value) return value;
  }
  return null;
}

function typesOf(node: Record<string, unknown>): string[] {
  const raw = node["@type"];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.toLowerCase());
}

/** Every `name` on a node whose @type is one we trust, deepest-last. */
function collectSchemaNames(
  node: unknown,
  depth = 0,
  out: string[] = [],
): string[] {
  if (depth > 8 || node === null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) collectSchemaNames(child, depth + 1, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  const name = obj["name"];
  if (
    typeof name === "string" &&
    name.trim().length >= 2 &&
    name.trim().length <= 80 &&
    typesOf(obj).some((t) => NAME_BEARING_TYPES.includes(t))
  ) {
    out.push(name.trim());
  }
  for (const value of Object.values(obj)) {
    collectSchemaNames(value, depth + 1, out);
  }
  return out;
}

function schemaName(html: string | null): string | null {
  if (!html) return null;
  const blockRe =
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const names: string[] = [];
  for (const m of html.matchAll(blockRe)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1]);
    } catch {
      continue;
    }
    collectSchemaNames(parsed, 0, names);
  }
  if (names.length === 0) return null;
  // Several name-bearing nodes means an operator listing its communities.
  // Taking one at random is the same mistake the address tier used to
  // make, so only a unanimous answer counts.
  const distinct = [...new Set(names.map((n) => n.toLowerCase()))];
  return distinct.length === 1 ? names[0] : null;
}

/**
 * Resolve the entity to audit. Pure and synchronous — the crawl is the
 * only input, so this is cheap to call as soon as the crawl resolves.
 */
export function resolveIdentity(input: {
  supplied?: string | null;
  domain: string;
  crawl: Pick<SiteCrawlResult, "html" | "title" | "resolvedUrl"> | null;
}): ResolvedIdentity {
  const { supplied, domain, crawl } = input;
  const resolvedUrl = crawl?.resolvedUrl ?? null;

  const typed = supplied?.trim();
  if (typed) {
    return {
      name: typed,
      nameSource: "supplied",
      resolvedUrl,
      confidence: "high",
    };
  }

  const fromSchema = schemaName(crawl?.html ?? null);
  if (fromSchema) {
    return {
      name: fromSchema,
      nameSource: "schema",
      resolvedUrl,
      confidence: "high",
    };
  }

  const fromOg = crawl?.html ? metaContent(crawl.html, "og:site_name") : null;
  if (fromOg && fromOg.length <= 80) {
    return { name: fromOg, nameSource: "og", resolvedUrl, confidence: "high" };
  }

  const fromTitle = cleanTitleName(crawl?.title ?? null);
  if (fromTitle) {
    return {
      name: fromTitle,
      nameSource: "title",
      resolvedUrl,
      confidence: "medium",
    };
  }

  return {
    name: brandNameFromDomain(domain),
    nameSource: "domain",
    resolvedUrl,
    confidence: "low",
  };
}
