import "server-only";

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
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  const token = Buffer.from(`${login}:${password}`).toString("base64");
  return `Basic ${token}`;
}

async function call<T>(
  path: string,
  body: unknown,
  label: string,
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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: `DataforSEO ${label} network error: ${message}` };
  }

  if (!res.ok) {
    let text = "";
    try {
      text = await res.text();
    } catch {
      /* ignore */
    }
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
    return {
      ok: false,
      error: `DataforSEO ${label} status ${json.status_code}: ${json.status_message}`,
    };
  }

  const task = json.tasks?.[0];
  if (!task) {
    return { ok: false, error: `DataforSEO ${label}: empty tasks array` };
  }
  if (task.status_code >= 40000) {
    return {
      ok: false,
      error: `DataforSEO ${label} task ${task.status_code}: ${task.status_message}`,
    };
  }

  // Cost audit log — every call writes a structured line so we can
  // grep `[dataforseo]` over the access log to reconcile usage.
  console.log(
    `[dataforseo] ${label} cost=$${task.cost.toFixed(5)} ok`,
  );

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

export async function fetchKeywordVolume(input: {
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

export async function fetchKeywordSuggestions(input: {
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

export async function fetchCompetitorDomains(input: {
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
  const result = await call<{ scores: LighthouseScores }>(
    "/on_page/lighthouse/live/json",
    [{ url: input.url, for_mobile: true }],
    `lighthouse[${input.url.slice(0, 64)}]`,
  );
  if (!("ok" in result) || !result.ok) {
    return result as CallResult<LighthouseScores>;
  }
  return {
    ok: true,
    data: result.data?.scores ?? {
      performance: null,
      accessibility: null,
      best_practices: null,
      seo: null,
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
