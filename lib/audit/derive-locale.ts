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
 * Deterministic tiers (1 + 2). Pure — exported for tests.
 */
export function parseLocaleFromCrawl(
  crawl: Pick<SiteCrawlResult, "html" | "title" | "description" | "schemaTypes"> | null,
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

  // Tier 1 — JSON-LD PostalAddress anywhere in any ld+json block.
  if (crawl.html) {
    const blockRe =
      /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    for (const m of crawl.html.matchAll(blockRe)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(m[1]);
      } catch {
        continue;
      }
      const addr = findPostalAddress(parsed);
      if (addr?.city) {
        return {
          ...none,
          city: addr.city,
          region: addr.region,
          source: "schema",
        };
      }
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

/** Recursively find the first object shaped like a PostalAddress. */
function findPostalAddress(
  node: unknown,
  depth = 0,
): { city: string; region: string | null } | null {
  if (depth > 8 || node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findPostalAddress(child, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const locality = obj["addressLocality"];
  if (typeof locality === "string" && locality.trim().length >= 2) {
    const regionRaw = obj["addressRegion"];
    const region =
      typeof regionRaw === "string" && US_STATES.has(regionRaw.trim().toUpperCase())
        ? regionRaw.trim().toUpperCase()
        : null;
    return { city: locality.trim(), region };
  }
  for (const value of Object.values(obj)) {
    const hit = findPostalAddress(value, depth + 1);
    if (hit) return hit;
  }
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
 * Full derivation: deterministic tiers, then one Haiku call only when
 * the city is still unknown. Never throws.
 */
export async function derivePropertyLocale(
  crawl: SiteCrawlResult | null,
  prospectAuditId: string | null,
): Promise<PropertyLocale> {
  const deterministic = parseLocaleFromCrawl(crawl);
  if (deterministic.city) return deterministic;
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
    return {
      city: object.city?.trim() || null,
      region: state && US_STATES.has(state) ? state : null,
      neighborhood: object.neighborhood?.trim() || null,
      category: object.category?.trim().toLowerCase() || deterministic.category,
      amenity: object.amenity?.trim() || null,
      source: object.city ? "llm" : "none",
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
