/**
 * Property locale derivation for the prospect audit's AEO discovery
 * prompts (2026-08-13, .claude/specs/2026-08-13-aeo-discovery-prompts-fix.md).
 *
 * The prospect audit only knows brandName + domain. Discovery prompts
 * ("best apartments in Berkeley") need a city. We derive it from the
 * homepage we already crawled, in three tiers:
 *
 *   1. schema.org PostalAddress in any JSON-LD block (free, exact)
 *   2. "City, ST" pattern in <title> / meta description (free, heuristic)
 *   3. One Claude Haiku call over the visible page text (~$0.001,
 *      also yields neighborhood / category / salient amenity)
 *
 * Returns nulls when nothing is derivable — the fan-out then falls back
 * to branded-only prompts and the UI says so.
 */

import "server-only";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { logUsage } from "@/lib/cost-tracker/log";
import { tokenCostUsd } from "@/lib/aeo/engines/pricing";
import type { SiteCrawlResult } from "@/lib/audit/site-crawl";

const LOCALE_MODEL = "claude-haiku-4-5-20251001";

export interface PropertyLocale {
  city: string | null;
  /** 2-letter US state code when known. */
  region: string | null;
  /** Named neighborhood / district / campus the property markets. */
  neighborhood: string | null;
  /** Housing type as renters search it. Always set (defaults). */
  category: string;
  /** Single most prominent amenity, for prompt variety. */
  amenity: string | null;
  source: "schema" | "meta" | "llm" | "none";
}

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
  "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
  "TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);

function defaultCategory(schemaTypes: string[]): string {
  const joined = schemaTypes.join(" ").toLowerCase();
  if (joined.includes("senior")) return "senior living communities";
  return "apartments";
}

/**
 * Fields the deterministic tiers read. H1 + canonical are optional so
 * existing callers and fixtures keep compiling.
 */
export type LocaleCrawlInput = Pick<
  SiteCrawlResult,
  "html" | "title" | "description" | "schemaTypes"
> &
  Partial<Pick<SiteCrawlResult, "h1FirstText" | "canonical">>;

/**
 * Deterministic tiers (1 + 2). Pure — exported for tests.
 */
export function parseLocaleFromCrawl(
  crawl: LocaleCrawlInput | null,
): PropertyLocale {
  const category = defaultCategory(crawl?.schemaTypes ?? []);
  const none: PropertyLocale = {
    city: null,
    region: null,
    neighborhood: null,
    category,
    amenity: null,
    source: "none",
  };
  if (!crawl) return none;

  // Tier 1 — every JSON-LD PostalAddress in every ld+json block, then one
  // pick by evidence. Abstains when the page names two properties.
  if (crawl.html) {
    const blockRe =
      /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const hits: AddressHit[] = [];
    for (const m of crawl.html.matchAll(blockRe)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(m[1]);
      } catch {
        continue;
      }
      collectPostalAddresses(parsed, 0, hits);
    }
    const addr = pickCorroboratedAddress(dedupeAddresses(hits), crawl);
    if (addr) {
      return {
        ...none,
        city: addr.city,
        region: addr.region,
        source: "schema",
      };
    }
  }

  // Tier 2 — "City, ST" in title/description. State code must be real.
  const hay = `${crawl.title ?? ""} · ${crawl.description ?? ""}`;
  const cityStateRe = /\b([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+){0,2}),\s*([A-Z]{2})\b/g;
  for (const m of hay.matchAll(cityStateRe)) {
    if (US_STATES.has(m[2])) {
      return { ...none, city: m[1], region: m[2], source: "meta" };
    }
  }

  return none;
}

interface AddressHit {
  city: string;
  region: string | null;
}

/**
 * Collect EVERY object shaped like a PostalAddress, not the first one.
 *
 * Taking the first hit audits whichever address the markup happens to list
 * first — a corporate HQ in the footer schema, or a sibling community on an
 * operator site. Observed 2026-08-26: leasestack.co and livehigby.com both
 * derived "Berkeley" off an address that belonged to another property.
 */
function collectPostalAddresses(
  node: unknown,
  depth = 0,
  out: AddressHit[] = [],
): AddressHit[] {
  if (depth > 8 || node === null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) collectPostalAddresses(child, depth + 1, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  const locality = obj["addressLocality"];
  if (typeof locality === "string" && locality.trim().length >= 2) {
    const regionRaw = obj["addressRegion"];
    const region =
      typeof regionRaw === "string" && US_STATES.has(regionRaw.trim().toUpperCase())
        ? regionRaw.trim().toUpperCase()
        : null;
    out.push({ city: locality.trim(), region });
    // Don't recurse into an address node's own children.
    return out;
  }
  for (const value of Object.values(obj)) {
    collectPostalAddresses(value, depth + 1, out);
  }
  return out;
}

/** Distinct by city (case-insensitive); first region seen for a city wins. */
function dedupeAddresses(hits: AddressHit[]): AddressHit[] {
  const seen = new Map<string, AddressHit>();
  for (const hit of hits) {
    const key = hit.city.toLowerCase();
    const prior = seen.get(key);
    if (!prior) seen.set(key, hit);
    else if (!prior.region && hit.region) seen.set(key, hit);
  }
  return [...seen.values()];
}

/**
 * Pick the address that the rest of the page corroborates. One candidate is
 * taken on faith. Several are only resolved when exactly one city is also
 * named in the title / description / H1 / canonical path — otherwise the
 * schema tier abstains and the caller falls through to the LLM tier, which
 * reads the whole page instead of trusting markup order.
 */
function pickCorroboratedAddress(
  candidates: AddressHit[],
  crawl: LocaleCrawlInput,
): AddressHit | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const evidence = [
    crawl.title,
    crawl.description,
    crawl.h1FirstText,
    crawl.canonical,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const corroborated = candidates.filter((c) =>
    evidence.includes(c.city.toLowerCase()),
  );
  if (corroborated.length === 1) return corroborated[0];
  console.warn(
    `[audit.locale] ${candidates.length} distinct schema localities, ` +
      `${corroborated.length} corroborated — deferring to the LLM tier: ` +
      candidates.map((c) => c.city).join(", "),
  );
  return null;
}

/** Strip crawled HTML to visible-ish text for the LLM tier. Exported for tests. */
export function stripHtmlToText(html: string, cap = 8000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, cap);
}

const llmLocaleSchema = z.object({
  city: z.string().nullable(),
  state: z.string().nullable(),
  neighborhood: z.string().nullable(),
  category: z.string().nullable(),
  amenity: z.string().nullable(),
});

/**
 * Full derivation: deterministic tiers, then one Haiku call to fill what
 * markup structurally cannot give us. Never throws.
 *
 * 2026-08-26: the Haiku tier no longer short-circuits on a schema city. A
 * schema hit only ever yielded city + region, so neighborhood, amenity and
 * category were null/default on every audit whose markup carried an
 * address — 100% of live reports asked "best apartments in <city>" and
 * discovery prompt #3 always used the generic "I'm moving to" variant.
 * Schema still wins on city/region; the LLM fills the rest. ~$0.001 per
 * audit against a ~$0.12 fan-out.
 */
export async function derivePropertyLocale(
  crawl: SiteCrawlResult | null,
  prospectAuditId: string | null,
): Promise<PropertyLocale> {
  const deterministic = parseLocaleFromCrawl(crawl);
  if (!process.env.ANTHROPIC_API_KEY || !crawl) return deterministic;

  // Lead with title + meta description — on JS-heavy sites the native-
  // fetch fallback's first 200KB is mostly <head> noise and the visible
  // body text is thin, but the title/description almost always carry the
  // location ("Student Housing Near UC Berkeley Campus", "2490 Channing
  // Way, Berkeley"). Observed on telegraphcommons.com 2026-08-13: body
  // text alone gave Haiku nothing.
  const parts = [
    crawl.title ? `Page title: ${crawl.title}` : "",
    crawl.description ? `Meta description: ${crawl.description}` : "",
    crawl.html ? `Page text: ${stripHtmlToText(crawl.html)}` : "",
  ].filter(Boolean);
  const text = parts.join("\n");
  if (text.length < 80) return deterministic;

  const startedAt = Date.now();
  try {
    const { object, usage } = await generateObject({
      model: anthropic(LOCALE_MODEL),
      schema: llmLocaleSchema,
      prompt: `This is content extracted from a rental property's homepage. Extract facts about the property itself. Use null for anything not explicitly stated — never guess.

- city: the city the property is located in
- state: 2-letter US state code (null if absent or non-US)
- neighborhood: named neighborhood, district, or campus the property markets itself near
- category: housing type as a renter would search it (e.g. "apartments", "student apartments", "senior living communities", "townhomes")
- amenity: the single most prominent amenity mentioned (e.g. "rooftop deck", "in-unit laundry")

Homepage content:
${text}`,
      maxOutputTokens: 300,
    });
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    await logUsage({
      provider: "anthropic",
      endpoint: `${LOCALE_MODEL}/audit-locale`,
      status: "SUCCESS",
      costUsd: tokenCostUsd(LOCALE_MODEL, inputTokens, outputTokens),
      durationMs: Date.now() - startedAt,
      prospectAuditId,
      meta: { model: LOCALE_MODEL, inputTokens, outputTokens },
    });
    const state = object.state?.trim().toUpperCase() ?? null;
    const llmCity = object.city?.trim() || null;
    const llmRegion = state && US_STATES.has(state) ? state : null;
    // Same city from both tiers means the LLM's state code is safe to use
    // when the markup omitted addressRegion (common: "San Diego", no CA).
    const sameCity =
      !!llmCity &&
      !!deterministic.city &&
      llmCity.toLowerCase() === deterministic.city.toLowerCase();
    return {
      city: deterministic.city ?? llmCity,
      region: deterministic.city
        ? (deterministic.region ?? (sameCity ? llmRegion : null))
        : llmRegion,
      neighborhood: object.neighborhood?.trim() || null,
      category: object.category?.trim().toLowerCase() || deterministic.category,
      amenity: object.amenity?.trim() || null,
      source: deterministic.city
        ? deterministic.source
        : llmCity
          ? "llm"
          : "none",
    };
  } catch (err) {
    console.error(
      "[audit.locale] Haiku locale derivation failed; branded-only fallback:",
      err instanceof Error ? err.message : err,
    );
    await logUsage({
      provider: "anthropic",
      endpoint: `${LOCALE_MODEL}/audit-locale`,
      status: "ERROR",
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      prospectAuditId,
      meta: { error: err instanceof Error ? err.message : String(err) },
    });
    return deterministic;
  }
}
