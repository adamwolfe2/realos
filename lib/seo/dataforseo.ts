import "server-only";
import { unstable_cache } from "next/cache";
import { logUsage } from "@/lib/cost-tracker/log";

// 30-day TTL: keyword volume, suggestions, competitor domains, intent,
// historical volume — none of these signals churn meaningfully week-over-
// week. Per-tag invalidation via `dataforseoCacheTag(domain)` exists for
// the rare manual-refresh case.
const DATAFORSEO_LONG_TTL_SECONDS = 30 * 24 * 60 * 60;

export function dataforseoCacheTag(scope: string): string {
  return `dataforseo:${scope.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// DataforSEO REST client.
//
// Thin wrapper around the handful of endpoints the SEO Agent uses. Auth is
// HTTP Basic with the account login + password set in Vercel env. Every
// request logs cost + endpoint to the console so we can audit spend later.
//
// Endpoints we use (cost per call in $):
//   serp/google/organic/live/advanced            0.002   What's ranking right now
//   keywords_data/google_ads/search_volume/live  0.0001  Volume + competition for a kw
//   dataforseo_labs/google/keyword_suggestions/live      0.01    Related keywords
//   dataforseo_labs/google/competitors_domain/live       0.02    Closest organic competitors
//   on_page/lighthouse/live/json                 0.01    Lighthouse audit
//   on_page/instant_pages                        0.005   Single page title/meta/H1 audit
//   backlinks/summary/live                       0.02    Domain authority + ref domains
//
// Env-gated: if DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD aren't set, every
// function returns { skipped: true } so the engine still runs (just
// without DataforSEO signal). Operator-facing UI degrades gracefully.
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.dataforseo.com/v3";

type CallResult<T> =
  | { ok: true; data: T; costUsd: number }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; error: string };

function authHeader(): string | null {
  // Defensive trim — Vercel env-var pasting via the dashboard frequently
  // bakes trailing "\n" (literal backslash-n) or real "\n" (newline) into
  // the stored value. HTTP Basic Auth's base64-encoded payload is byte-
  // exact, so any trailing whitespace silently turns every call into a
  // 401. Strip both forms here so the cred survives sloppy paste.
  const login = process.env.DATAFORSEO_LOGIN?.replace(/\\n|\s+/g, "").trim();
  const password = process.env.DATAFORSEO_PASSWORD?.replace(/\\n|\s+/g, "").trim();
  if (!login || !password) return null;
  const token = Buffer.from(`${login}:${password}`).toString("base64");
  return `Basic ${token}`;
}

/**
 * Optional per-call context. Mostly used by the AEO adapter to attribute
 * cost to a specific org/property/audit + tag the call's surface so
 * `/admin/costs` can split AEO vs SEO-Agent spend. `surface` defaults to
 * "seo-agent" — the original consumer — when nothing is passed.
 *
 * `timeoutMs` defaults to 20s. The previous behavior was unbounded, which
 * meant a stuck DataForSEO call could burn the cron's 300s ceiling on a
 * single (engine, prompt) tuple. 20s is comfortably above DataForSEO's
 * documented p95 (~5s) and well below the cron throttle window.
 */
export interface DataforseoCallContext {
  prospectAuditId?: string | null;
  orgId?: string | null;
  propertyId?: string | null;
  surface?: "aeo" | "seo-agent" | "audit" | "signals";
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;

async function call<T>(
  path: string,
  body: unknown,
  label: string,
  ctx?: DataforseoCallContext,
): Promise<CallResult<T>> {
  const auth = authHeader();
  if (!auth) {
    return {
      ok: false,
      skipped: true,
      reason:
        "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not configured. SEO Agent will run without DataforSEO signal.",
    };
  }

  const startedAt = Date.now();
  const surface = ctx?.surface ?? "seo-agent";
  const timeoutMs = ctx?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // Common attribution fields threaded into every logUsage write — same
  // shape the AEO direct engines use so /admin/costs can split AEO vs
  // SEO-Agent spend per org/property.
  const attribution = {
    orgId: ctx?.orgId ?? null,
    propertyId: ctx?.propertyId ?? null,
    prospectAuditId: ctx?.prospectAuditId ?? null,
  };
  const tag = (extra: Record<string, unknown>): Record<string, unknown> => ({
    surface,
    ...extra,
  });
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      // DataforSEO accepts an array of task envelopes per call. The
      // single-task pattern matches their "live" endpoints (instant
      // response, no polling). Batched endpoints use POST-then-GET.
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    // Log the failed attempt so we can spot connection-tier issues on
    // /admin/costs (zero cost but ERROR status).
    await logUsage({
      provider: "dataforseo",
      endpoint: label,
      status: "ERROR",
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      ...attribution,
      meta: tag({ phase: "network", message: message.slice(0, 240) }),
    });
    return { ok: false, error: `DataforSEO ${label} network error: ${message}` };
  }

  if (!res.ok) {
    let text = "";
    try {
      text = await res.text();
    } catch {
      /* ignore */
    }
    await logUsage({
      provider: "dataforseo",
      endpoint: label,
      status: "ERROR",
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      ...attribution,
      meta: tag({ phase: "http", statusCode: res.status, body: text.slice(0, 200) }),
    });
    return {
      ok: false,
      error: `DataforSEO ${label} ${res.status}: ${text.slice(0, 240)}`,
    };
  }

  const json = (await res.json()) as {
    status_code: number;
    status_message: string;
    cost: number;
    tasks: Array<{
      status_code: number;
      status_message: string;
      cost: number;
      result: T;
    }>;
  };

  if (json.status_code >= 40000) {
    await logUsage({
      provider: "dataforseo",
      endpoint: label,
      status: "ERROR",
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      ...attribution,
      meta: tag({ phase: "envelope", taskStatus: json.status_code, message: json.status_message }),
    });
    return {
      ok: false,
      error: `DataforSEO ${label} status ${json.status_code}: ${json.status_message}`,
    };
  }

  const task = json.tasks?.[0];
  if (!task) {
    await logUsage({
      provider: "dataforseo",
      endpoint: label,
      status: "ERROR",
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      ...attribution,
      meta: tag({ phase: "empty_tasks" }),
    });
    return { ok: false, error: `DataforSEO ${label}: empty tasks array` };
  }
  if (task.status_code >= 40000) {
    // Task-level error still incurred minimum spend on DataForSEO's
    // side. Log the partial cost they returned (typically 0 for hard
    // 40xxx but DataForSEO occasionally charges for partial fan-outs).
    await logUsage({
      provider: "dataforseo",
      endpoint: label,
      status: "ERROR",
      costUsd: task.cost ?? 0,
      durationMs: Date.now() - startedAt,
      ...attribution,
      meta: tag({ phase: "task", taskStatus: task.status_code, message: task.status_message }),
    });
    return {
      ok: false,
      error: `DataforSEO ${label} task ${task.status_code}: ${task.status_message}`,
    };
  }

  // Cost audit log + DB row. The console line stays so existing log
  // tooling still works; the DB row backs /admin/costs rollups.
  console.log(
    `[dataforseo] ${label} cost=$${task.cost.toFixed(5)} ok`,
  );
  await logUsage({
    provider: "dataforseo",
    endpoint: label,
    status: "SUCCESS",
    costUsd: task.cost,
    durationMs: Date.now() - startedAt,
    ...attribution,
    meta: tag({ taskStatus: task.status_code }),
  });

  return { ok: true, data: task.result, costUsd: task.cost };
}

// ---------------------------------------------------------------------------
// SERP — current organic results for a target query
// ---------------------------------------------------------------------------

export type SerpOrganicResult = {
  rank_group: number;
  rank_absolute: number;
  domain: string;
  title: string;
  description: string;
  url: string;
};

export async function fetchSerpOrganic(input: {
  query: string;
  /** Two-letter language; default "en". */
  language?: string;
  /** Location code (DataforSEO numeric). Default 2840 = United States. */
  locationCode?: number;
}): Promise<CallResult<SerpOrganicResult[]>> {
  const result = await call<
    Array<{ items: SerpOrganicResult[] }>
  >(
    "/serp/google/organic/live/advanced",
    [
      {
        keyword: input.query,
        language_code: input.language ?? "en",
        location_code: input.locationCode ?? 2840,
        depth: 10,
      },
    ],
    `serp.organic[${input.query.slice(0, 32)}]`,
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<SerpOrganicResult[]>;
  }
  return {
    ok: true,
    data: result.data?.[0]?.items ?? [],
    costUsd: result.costUsd,
  };
}

// ---------------------------------------------------------------------------
// Keyword research — volume + competition for a single keyword
// ---------------------------------------------------------------------------

export type KeywordSearchVolume = {
  keyword: string;
  search_volume: number | null;
  competition: number | null;
  cpc: number | null;
};

async function fetchKeywordVolumeUncached(input: {
  keywords: string[];
  locationCode?: number;
}): Promise<CallResult<KeywordSearchVolume[]>> {
  if (input.keywords.length === 0) {
    return { ok: true, data: [], costUsd: 0 };
  }
  const result = await call<KeywordSearchVolume[]>(
    "/keywords_data/google_ads/search_volume/live",
    [
      {
        keywords: input.keywords.slice(0, 1000),
        location_code: input.locationCode ?? 2840,
      },
    ],
    `keywords.volume[${input.keywords.length}]`,
  );
  return result;
}

export async function fetchKeywordVolume(input: {
  keywords: string[];
  locationCode?: number;
}): Promise<CallResult<KeywordSearchVolume[]>> {
  if (input.keywords.length === 0) {
    return { ok: true, data: [], costUsd: 0 };
  }
  const sortedKeywords = [...input.keywords].sort();
  const cached = unstable_cache(
    async () => fetchKeywordVolumeUncached(input),
    [
      "dataforseo-keyword-volume",
      sortedKeywords.join(","),
      String(input.locationCode ?? 2840),
    ],
    {
      revalidate: DATAFORSEO_LONG_TTL_SECONDS,
      tags: [dataforseoCacheTag("keyword-volume")],
    },
  );
  return cached();
}

// ---------------------------------------------------------------------------
// Keyword suggestions — related keywords for a seed
// ---------------------------------------------------------------------------

export type KeywordSuggestion = {
  keyword: string;
  search_volume: number | null;
  keyword_difficulty: number | null;
  competition: number | null;
  cpc: number | null;
};

async function fetchKeywordSuggestionsUncached(input: {
  seed: string;
  limit?: number;
  locationCode?: number;
}): Promise<CallResult<KeywordSuggestion[]>> {
  const result = await call<
    Array<{ items: Array<{ keyword_data: KeywordSuggestion }> }>
  >(
    "/dataforseo_labs/google/keyword_suggestions/live",
    [
      {
        keyword: input.seed,
        location_code: input.locationCode ?? 2840,
        language_code: "en",
        limit: Math.min(input.limit ?? 100, 1000),
      },
    ],
    `keywords.suggest[${input.seed.slice(0, 32)}]`,
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<KeywordSuggestion[]>;
  }
  return {
    ok: true,
    data: (result.data?.[0]?.items ?? []).map((i) => i.keyword_data),
    costUsd: result.costUsd,
  };
}

export async function fetchKeywordSuggestions(input: {
  seed: string;
  limit?: number;
  locationCode?: number;
}): Promise<CallResult<KeywordSuggestion[]>> {
  const cached = unstable_cache(
    async () => fetchKeywordSuggestionsUncached(input),
    [
      "dataforseo-keyword-suggestions",
      input.seed,
      String(input.limit ?? 100),
      String(input.locationCode ?? 2840),
    ],
    {
      revalidate: DATAFORSEO_LONG_TTL_SECONDS,
      tags: [dataforseoCacheTag("keyword-suggestions")],
    },
  );
  return cached();
}

// ---------------------------------------------------------------------------
// Competitor domains — closest organic competitors for a target domain
// ---------------------------------------------------------------------------

export type CompetitorDomain = {
  domain: string;
  intersections: number; // Shared ranking keywords
  median_position: number | null;
  full_domain_metrics: {
    organic_etv: number | null;
    organic_count: number | null;
  } | null;
};

async function fetchCompetitorDomainsUncached(input: {
  domain: string;
  limit?: number;
  locationCode?: number;
}): Promise<CallResult<CompetitorDomain[]>> {
  const result = await call<Array<{ items: CompetitorDomain[] }>>(
    "/dataforseo_labs/google/competitors_domain/live",
    [
      {
        target: input.domain,
        location_code: input.locationCode ?? 2840,
        language_code: "en",
        limit: Math.min(input.limit ?? 10, 50),
      },
    ],
    `competitors[${input.domain}]`,
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<CompetitorDomain[]>;
  }
  return {
    ok: true,
    data: result.data?.[0]?.items ?? [],
    costUsd: result.costUsd,
  };
}

export async function fetchCompetitorDomains(input: {
  domain: string;
  limit?: number;
  locationCode?: number;
}): Promise<CallResult<CompetitorDomain[]>> {
  const cached = unstable_cache(
    async () => fetchCompetitorDomainsUncached(input),
    [
      "dataforseo-competitor-domains",
      input.domain,
      String(input.limit ?? 10),
      String(input.locationCode ?? 2840),
    ],
    {
      revalidate: DATAFORSEO_LONG_TTL_SECONDS,
      tags: [dataforseoCacheTag(`competitors:${input.domain}`)],
    },
  );
  return cached();
}

// ---------------------------------------------------------------------------
// On-page Lighthouse audit — Core Web Vitals + SEO + Accessibility
// ---------------------------------------------------------------------------

export type LighthouseScores = {
  performance: number | null;
  accessibility: number | null;
  best_practices: number | null;
  seo: number | null;
  pwa: number | null;
};

export async function fetchLighthouseScores(input: {
  url: string;
}): Promise<CallResult<LighthouseScores>> {
  // DataforSEO wraps the full Lighthouse JSON in `result` directly (no
  // intermediate `scores` key). Categories are keyed `performance`,
  // `accessibility`, `best-practices` (hyphen, not underscore), `seo`.
  // Each category has { score: 0..1 } — we scale to 0..100 for the
  // operator UI here so callers don't have to remember the unit. PWA
  // isn't part of Lighthouse 10+ anymore — we still expose the field
  // null-typed for backwards compat with downstream UI.
  //
  // The previous parser read result.data.scores.* which never existed
  // in the real response, so every Lighthouse run silently stored nulls
  // on OnPageAudit despite the scan reporting "1 lighthouse audit
  // completed."
  type LighthouseCategory = { score?: number | null };
  type LighthouseRaw = {
    categories?: {
      performance?: LighthouseCategory;
      accessibility?: LighthouseCategory;
      "best-practices"?: LighthouseCategory;
      seo?: LighthouseCategory;
    };
    audits?: Record<string, { numericValue?: number | null } | undefined>;
  };
  const result = await call<LighthouseRaw[]>(
    "/on_page/lighthouse/live/json",
    [{ url: input.url, for_mobile: true }],
    `lighthouse[${input.url.slice(0, 64)}]`,
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<LighthouseScores>;
  }
  const raw = Array.isArray(result.data) ? result.data[0] : null;
  const cats = raw?.categories;
  const score = (cat?: LighthouseCategory): number | null => {
    const v = cat?.score;
    if (v == null) return null;
    return Math.round(v * 100);
  };
  return {
    ok: true,
    data: {
      performance: score(cats?.performance),
      accessibility: score(cats?.accessibility),
      best_practices: score(cats?.["best-practices"]),
      seo: score(cats?.seo),
      // PWA category was removed in Lighthouse 10. Keep null so the
      // OnPageAudit row still gets a defined value and the UI can show
      // "—" rather than crash on undefined.
      pwa: null,
    },
    costUsd: result.costUsd,
  };
}

// ---------------------------------------------------------------------------
// Backlinks summary — domain authority + referring domains count
// ---------------------------------------------------------------------------

export type BacklinksSummary = {
  rank: number | null;
  backlinks: number;
  referring_domains: number;
  referring_main_domains: number;
};

export async function fetchBacklinksSummary(input: {
  target: string;
}): Promise<CallResult<BacklinksSummary>> {
  const result = await call<BacklinksSummary>(
    "/backlinks/summary/live",
    [{ target: input.target }],
    `backlinks[${input.target}]`,
  );
  return result;
}

/**
 * True when DataforSEO is configured. Use in UI to gate "needs setup"
 * messaging vs. real data.
 */
export function isDataforSeoConfigured(): boolean {
  return Boolean(
    process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD,
  );
}

// ===========================================================================
// PHASE 2 — Extended endpoints
// ===========================================================================

// ---------------------------------------------------------------------------
// On-Page instant_pages — full single-page audit (titles, meta, H1s,
// images, links, schema). Beyond Lighthouse. ~$0.005/call.
// ---------------------------------------------------------------------------

export type InstantPageAudit = {
  meta: {
    title: string | null;
    description: string | null;
    keywords: string | null;
    canonical: string | null;
    htags: { h1?: string[]; h2?: string[]; h3?: string[] };
    content: {
      plain_text_word_count: number | null;
      automated_readability_index: number | null;
    } | null;
    images_count: number | null;
    images_size: number | null;
    internal_links_count: number | null;
    external_links_count: number | null;
    duplicate_title: boolean;
    duplicate_description: boolean;
    no_image_alt: number;
    broken_resources: number;
    broken_links: number;
    is_https: boolean;
  };
  checks: Record<string, boolean>;
  // Detected schema.org / JSON-LD types.
  schema?: { type?: string[] };
};

export async function fetchInstantPageAudit(input: {
  url: string;
}): Promise<CallResult<InstantPageAudit>> {
  const result = await call<Array<{ items: Array<{ meta: InstantPageAudit["meta"]; checks: Record<string, boolean>; }> }>>(
    "/on_page/instant_pages",
    // `custom_js: ""` was rejected as "Invalid Field" — must be omitted
    // unless we actually have a script to inject. Keep enable_javascript
    // so SPAs (a lot of property marketing sites) render their content
    // before the audit fires.
    [{ url: input.url, enable_javascript: true }],
    `instant_pages[${input.url.slice(0, 48)}]`,
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<InstantPageAudit>;
  }
  const item = result.data?.[0]?.items?.[0];
  if (!item) {
    return { ok: false, error: "instant_pages: empty result" };
  }
  return {
    ok: true,
    data: { meta: item.meta, checks: item.checks },
    costUsd: result.costUsd,
  };
}

// ---------------------------------------------------------------------------
// DataforSEO Labs — search_intent classifier (informational, navigational,
// commercial, transactional). ~$0.01/call for up to 1000 keywords.
// ---------------------------------------------------------------------------

export type IntentClassification = {
  keyword: string;
  intent: "informational" | "navigational" | "commercial" | "transactional";
  probability: number;
};

export async function fetchSearchIntent(input: {
  keywords: string[];
  locationCode?: number;
}): Promise<CallResult<IntentClassification[]>> {
  if (input.keywords.length === 0) return { ok: true, data: [], costUsd: 0 };
  const result = await call<Array<{ items: Array<{ keyword: string; keyword_intent: { label: string; probability: number } }> }>>(
    "/dataforseo_labs/google/search_intent/live",
    [
      {
        keywords: input.keywords.slice(0, 1000),
        location_code: input.locationCode ?? 2840,
        language_code: "en",
      },
    ],
    `intent[${input.keywords.length}]`,
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<IntentClassification[]>;
  }
  const items = (result.data?.[0]?.items ?? []).map((i) => ({
    keyword: i.keyword,
    intent: (i.keyword_intent?.label ?? "informational") as IntentClassification["intent"],
    probability: i.keyword_intent?.probability ?? 0,
  }));
  return { ok: true, data: items, costUsd: result.costUsd };
}

// ---------------------------------------------------------------------------
// DataforSEO Labs — keyword_intersection. Queries the competitor outranks
// us on. Pure content-gap analysis. ~$0.02/call.
// ---------------------------------------------------------------------------

export type IntersectionKeyword = {
  keyword: string;
  search_volume: number | null;
  competition: number | null;
  cpc: number | null;
  // Positions are returned per-domain in the order targets were passed.
  intersection_result: Array<{ position: number | null; url: string | null }>;
};

export async function fetchKeywordIntersection(input: {
  ourDomain: string;
  competitorDomain: string;
  limit?: number;
  locationCode?: number;
}): Promise<CallResult<IntersectionKeyword[]>> {
  const result = await call<Array<{ items: IntersectionKeyword[] }>>(
    "/dataforseo_labs/google/domain_intersection/live",
    [
      {
        target1: input.ourDomain,
        target2: input.competitorDomain,
        location_code: input.locationCode ?? 2840,
        language_code: "en",
        // Filter to queries the competitor wins. position[0] = our rank.
        intersections: false,
        limit: Math.min(input.limit ?? 100, 1000),
      },
    ],
    `intersection[${input.ourDomain}|${input.competitorDomain}]`,
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<IntersectionKeyword[]>;
  }
  return {
    ok: true,
    data: result.data?.[0]?.items ?? [],
    costUsd: result.costUsd,
  };
}

// ---------------------------------------------------------------------------
// DataforSEO Labs — ranked_keywords. Every keyword OUR domain ranks for.
// Drives the keyword-portfolio breakdown by position bucket. ~$0.02/call.
// ---------------------------------------------------------------------------

export type DomainRankedKeyword = {
  keyword_data: {
    keyword: string;
    keyword_info: {
      search_volume: number | null;
      competition: number | null;
      cpc: number | null;
    } | null;
  };
  ranked_serp_element: {
    serp_item: {
      rank_absolute: number;
      url: string | null;
    };
  };
};

export async function fetchRankedKeywords(input: {
  domain: string;
  limit?: number;
  locationCode?: number;
}): Promise<CallResult<DomainRankedKeyword[]>> {
  const result = await call<Array<{ items: DomainRankedKeyword[] }>>(
    "/dataforseo_labs/google/ranked_keywords/live",
    [
      {
        target: input.domain,
        location_code: input.locationCode ?? 2840,
        language_code: "en",
        limit: Math.min(input.limit ?? 100, 1000),
        order_by: ["ranked_serp_element.serp_item.rank_absolute,asc"],
      },
    ],
    `ranked[${input.domain}]`,
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<DomainRankedKeyword[]>;
  }
  return {
    ok: true,
    data: result.data?.[0]?.items ?? [],
    costUsd: result.costUsd,
  };
}

// ---------------------------------------------------------------------------
// DataforSEO Labs — historical_search_volume. 24-month volume per keyword.
// ~$0.005/call.
// ---------------------------------------------------------------------------

export type HistoricalVolume = {
  keyword: string;
  history: Array<{ year: number; month: number; search_volume: number }>;
};

export async function fetchHistoricalSearchVolume(input: {
  keywords: string[];
  locationCode?: number;
}): Promise<CallResult<HistoricalVolume[]>> {
  if (input.keywords.length === 0) return { ok: true, data: [], costUsd: 0 };
  const result = await call<
    Array<{ items: Array<{ keyword: string; keyword_info: { history: HistoricalVolume["history"] } | null }> }>
  >(
    "/dataforseo_labs/google/historical_search_volume/live",
    [
      {
        keywords: input.keywords.slice(0, 1000),
        location_code: input.locationCode ?? 2840,
        language_code: "en",
      },
    ],
    `historical[${input.keywords.length}]`,
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<HistoricalVolume[]>;
  }
  const items = (result.data?.[0]?.items ?? []).map((i) => ({
    keyword: i.keyword,
    history: i.keyword_info?.history ?? [],
  }));
  return { ok: true, data: items, costUsd: result.costUsd };
}

// ---------------------------------------------------------------------------
// Business Data — Google My Business info. Local pack data, GBP rating +
// review count + categories. ~$0.005/call.
// ---------------------------------------------------------------------------

export type GoogleBusinessInfo = {
  title: string;
  category: string | null;
  rating: { value: number | null; votes_count: number };
  // Search-result-specific fields.
  cid: string | null;
  feature_id: string | null;
  domain: string | null;
  phone: string | null;
  address: string | null;
  rank_absolute: number | null;
};

export async function fetchGoogleBusinessInfo(input: {
  keyword: string;
  locationCode?: number;
}): Promise<CallResult<GoogleBusinessInfo[]>> {
  const result = await call<Array<{ items: GoogleBusinessInfo[] }>>(
    "/business_data/google/my_business_info/live",
    [
      {
        keyword: input.keyword,
        location_code: input.locationCode ?? 2840,
        language_code: "en",
      },
    ],
    `gbp[${input.keyword.slice(0, 32)}]`,
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<GoogleBusinessInfo[]>;
  }
  return {
    ok: true,
    data: result.data?.[0]?.items ?? [],
    costUsd: result.costUsd,
  };
}

// ---------------------------------------------------------------------------
// SERP API — local pack rankings. Returns the 3-result local pack for a
// query so we can track who shows up on the map. ~$0.002/call.
// ---------------------------------------------------------------------------

export type LocalPackResult = {
  position: number;
  title: string;
  domain: string | null;
  url: string | null;
  rating: { value: number | null; votes_count: number } | null;
  cid: string | null;
};

export async function fetchLocalPack(input: {
  query: string;
  locationCode?: number;
}): Promise<CallResult<LocalPackResult[]>> {
  // Local pack rows come embedded in the regular organic SERP advanced
  // response under type=local_pack. Reuse the same endpoint and filter.
  const result = await call<
    Array<{ items: Array<{ type: string; rank_absolute: number; title: string; domain?: string; url?: string; rating?: { value: number; votes_count: number }; cid?: string; items?: Array<{ rank_absolute: number; title: string; domain?: string; url?: string; rating?: { value: number; votes_count: number }; cid?: string }> }> }>
  >(
    "/serp/google/organic/live/advanced",
    [
      {
        keyword: input.query,
        location_code: input.locationCode ?? 2840,
        language_code: "en",
        depth: 20,
      },
    ],
    `local_pack[${input.query.slice(0, 32)}]`,
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<LocalPackResult[]>;
  }
  const items = result.data?.[0]?.items ?? [];
  // Find the local_pack container item (single SERP feature) then
  // unpack its `items` array.
  const container = items.find((i) => i.type === "local_pack");
  const packItems = (container?.items ?? []).map((p, idx) => ({
    position: p.rank_absolute ?? idx + 1,
    title: p.title,
    domain: p.domain ?? null,
    url: p.url ?? null,
    rating: p.rating ?? null,
    cid: p.cid ?? null,
  }));
  return { ok: true, data: packItems, costUsd: result.costUsd };
}

// ---------------------------------------------------------------------------
// AI Optimization — LLM Responses, AI Keyword Data, SERP AI Summary
//
// DataForSEO's AI Optimization product family proxies the four major
// engines (Claude, ChatGPT, Gemini, Perplexity) through a single billable
// surface at ~$0.0005-$0.003 per call. We use it as the primary AEO
// transport: cheaper, deterministic mention enumeration, single auth.
//
// Endpoint cost (approx, per DataForSEO docs as of 2026-06):
//   /ai_optimization/<engine>/llm_responses/live           0.0005-0.003
//   /ai_optimization/ai_keyword_data/keywords_search_volume/live  0.001 / kw
//   /serp/google/ai_summary/live/advanced                  0.003
//
// Engine slug mapping (DataForSEO path segment vs. our AeoEngine enum):
//   CLAUDE     -> claude
//   CHATGPT    -> chat_gpt
//   PERPLEXITY -> perplexity
//   GEMINI     -> google
// ---------------------------------------------------------------------------

export type AiOptimizationEngine =
  | "CLAUDE"
  | "CHATGPT"
  | "PERPLEXITY"
  | "GEMINI";

function aiOptimizationPathSegment(engine: AiOptimizationEngine): string {
  switch (engine) {
    case "CLAUDE":
      return "claude";
    case "CHATGPT":
      return "chat_gpt";
    case "PERPLEXITY":
      return "perplexity";
    case "GEMINI":
      return "google";
  }
}

/**
 * One entity mentioned in the engine's answer, normalized from DataForSEO's
 * `mentions[]` shape into our internal kind-classified form.
 */
export type AiLlmMention = {
  name: string;
  position: number;
  citedUrl: string | null;
  /// "self" | "competitor" | "other" — classifier filled in by the caller,
  /// not DataForSEO. The wrapper returns "other" by default; the AEO
  /// orchestrator decides what counts as self vs. competitor for this org.
  kind: "self" | "competitor" | "other";
};

export type AiLlmResponseResult = {
  /// DataForSEO request id (for replay/debug).
  externalId: string | null;
  /// Raw model output. Persisted as `responseText` on AeoCitationCheck.
  responseText: string;
  /// All URLs the model cited inline.
  citedUrls: string[];
  /// All entities the model mentioned, in order. Kind is "other" for
  /// every entry; classify upstream against (brand, competitors).
  mentions: AiLlmMention[];
  /// Raw provider response for the JSON column.
  raw: Record<string, unknown>;
};

/**
 * Run a prompt through DataForSEO's AI Optimization LLM Responses endpoint.
 * Returns the model's answer + cited URLs + ordered mentions list.
 *
 * Throws nothing. Env-gated skip + HTTP/envelope errors flow through the
 * same `CallResult` discriminated union as the rest of the dataforseo
 * client. Engine modules treat `skipped` and `error` as `{ skipped: true }`
 * so the orchestrator records nothing for that tuple and moves on.
 */
export async function fetchAiLlmResponse(
  input: {
    engine: AiOptimizationEngine;
    prompt: string;
    locationCode?: number;
  },
  ctx?: DataforseoCallContext,
): Promise<CallResult<AiLlmResponseResult>> {
  const segment = aiOptimizationPathSegment(input.engine);
  // Build the request body without spurious `undefined` keys — JSON.stringify
  // emits "model_name":null for those, which DataForSEO has on occasion
  // treated as "select default" but is undocumented. Cleaner to omit.
  const requestBody: Record<string, unknown> = {
    prompt: input.prompt,
    location_code: input.locationCode ?? 2840,
    language_code: "en",
  };
  const result = await call<
    Array<{
      id?: string;
      response?: string;
      message?: string;
      items?: Array<{
        type?: string;
        text?: string;
        citation_urls?: string[];
        mentions?: Array<{
          name?: string;
          position?: number;
          url?: string;
        }>;
      }>;
      mentions?: Array<{ name?: string; position?: number; url?: string }>;
      citation_urls?: string[];
    }>
  >(
    `/ai_optimization/${segment}/llm_responses/live`,
    [requestBody],
    `ai_llm[${input.engine.toLowerCase()}][${input.prompt.slice(0, 32)}]`,
    { surface: "aeo", ...ctx },
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<AiLlmResponseResult>;
  }
  const top = result.data?.[0] ?? {};
  const item = top.items?.[0] ?? {};
  const responseText =
    item.text ?? top.response ?? top.message ?? "";
  // DataForSEO returns citation_urls + mentions at either the top level
  // or inside items[0] depending on the engine. Coalesce both.
  const citedUrls = Array.from(
    new Set([
      ...(item.citation_urls ?? []),
      ...(top.citation_urls ?? []),
    ]),
  ).filter((u): u is string => typeof u === "string" && u.length > 0);
  const rawMentions = [
    ...(item.mentions ?? []),
    ...(top.mentions ?? []),
  ];
  const mentions: AiLlmMention[] = rawMentions
    .filter((m) => m && typeof m.name === "string" && m.name.length > 0)
    .map((m, idx) => ({
      name: m.name as string,
      position: m.position ?? idx + 1,
      citedUrl: m.url ?? null,
      kind: "other" as const,
    }));
  return {
    ok: true,
    costUsd: result.costUsd,
    data: {
      externalId: top.id ?? null,
      responseText,
      citedUrls,
      mentions,
      raw: top as Record<string, unknown>,
    },
  };
}

/**
 * AI Keyword Data — search volume for keywords inside AI engines (ChatGPT,
 * Perplexity, etc.). Used in W2 for AEO Opportunity Score; wrapper ships
 * now so W2 is glue-only. Not invoked in W1.
 */
export type AiKeywordVolumeResult = {
  keyword: string;
  /// Estimated monthly searches inside AI engines, 0 when unknown.
  aiSearchVolume: number;
  /// Engine distribution for the volume estimate, e.g. {chatgpt: 0.6, perplexity: 0.3}.
  engineShare: Record<string, number>;
};

export async function fetchAiKeywordVolume(
  input: {
    keywords: string[];
    locationCode?: number;
  },
  ctx?: DataforseoCallContext,
): Promise<CallResult<AiKeywordVolumeResult[]>> {
  if (input.keywords.length === 0) {
    return { ok: true, data: [], costUsd: 0 };
  }
  const result = await call<
    Array<{
      items?: Array<{
        keyword?: string;
        ai_search_volume?: number;
        engine_distribution?: Record<string, number>;
      }>;
    }>
  >(
    "/ai_optimization/ai_keyword_data/keywords_search_volume/live",
    [
      {
        keywords: input.keywords.slice(0, 100),
        location_code: input.locationCode ?? 2840,
        language_code: "en",
      },
    ],
    `ai_kw[${input.keywords.length}]`,
    { surface: "aeo", ...ctx },
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<AiKeywordVolumeResult[]>;
  }
  const items = result.data?.[0]?.items ?? [];
  return {
    ok: true,
    costUsd: result.costUsd,
    data: items.map((row) => ({
      keyword: row.keyword ?? "",
      aiSearchVolume: row.ai_search_volume ?? 0,
      engineShare: row.engine_distribution ?? {},
    })),
  };
}

/**
 * Google's AI Overview ("SGE") for a SERP query. Used in W2 as a new row
 * inside the AEO surface alongside the existing engine rows.
 */
export type SerpAiSummaryResult = {
  query: string;
  /// AI Overview text (Google's summary). Empty when not present for this query.
  summary: string;
  citedUrls: string[];
};

export async function fetchSerpAiSummary(
  input: {
    query: string;
    locationCode?: number;
  },
  ctx?: DataforseoCallContext,
): Promise<CallResult<SerpAiSummaryResult>> {
  const result = await call<
    Array<{
      items?: Array<{
        type?: string;
        text?: string;
        references?: Array<{ url?: string }>;
      }>;
    }>
  >(
    "/serp/google/ai_summary/live/advanced",
    [
      {
        keyword: input.query,
        location_code: input.locationCode ?? 2840,
        language_code: "en",
      },
    ],
    `ai_summary[${input.query.slice(0, 32)}]`,
    { surface: "aeo", ...ctx },
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<SerpAiSummaryResult>;
  }
  const items = result.data?.[0]?.items ?? [];
  const summaryItem = items.find((i) => i.type === "ai_overview") ?? items[0];
  return {
    ok: true,
    costUsd: result.costUsd,
    data: {
      query: input.query,
      summary: summaryItem?.text ?? "",
      citedUrls: (summaryItem?.references ?? [])
        .map((r) => r.url)
        .filter((u): u is string => typeof u === "string" && u.length > 0),
    },
  };
}
