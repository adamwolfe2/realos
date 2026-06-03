/**
 * Firecrawl REST wrapper.
 *
 * Thin typed client around the Firecrawl /scrape, /crawl, /search endpoints.
 * Auth header: `Authorization: Bearer ${process.env.FIRECRAWL_API_KEY}`.
 * Base URL: `https://api.firecrawl.dev/v1`.
 *
 * Every function returns a discriminated union:
 *   - { ok: true, data, costUsd }
 *   - { ok: false, error, skipped?: true, reason? }
 *
 * `skipped: true` means the call never went out — typically because the API
 * key is missing. Callers are expected to short-circuit on `skipped` without
 * treating it as a hard error so the rest of the ingest pipeline still runs.
 *
 * No new deps — uses native fetch (same pattern as lib/aeo/engines/perplexity.ts).
 */

import "server-only";
import { unstable_cache } from "next/cache";

const BASE_URL = "https://api.firecrawl.dev/v1";

// Cache TTLs for the two cheap-to-cache endpoints. /scrape responses for
// marketing/brand pages don't move daily; /search results for cornerstone
// discovery are tied to relatively stable web indexes. 7 days strikes a
// safe balance — operator-triggered "Refresh" can bust via the tag.
const FIRECRAWL_SCRAPE_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const FIRECRAWL_SEARCH_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

export function firecrawlScrapeCacheTag(url: string): string {
  // Stable tag per origin so a "refresh this site" action can sweep
  // every cached page from that domain in one call.
  try {
    return `firecrawl:scrape:${new URL(url).host.toLowerCase()}`;
  } catch {
    return `firecrawl:scrape:invalid`;
  }
}

export function firecrawlSearchCacheTag(): string {
  return `firecrawl:search`;
}

// Firecrawl public pricing as of 2026-05: ~$0.0008/page for /scrape and
// /crawl, and ~$0.002/query for /search. These are coarse estimates we log
// alongside each call so the caller can roll them into `lastRunStats`.
const COST_PER_PAGE_USD = 0.0008;
const COST_PER_SEARCH_USD = 0.002;

export type FirecrawlOk<T> = { ok: true; data: T; costUsd: number };
export type FirecrawlErr = {
  ok: false;
  error: string;
  skipped?: boolean;
  reason?: string;
};
export type FirecrawlResult<T> = FirecrawlOk<T> | FirecrawlErr;

export interface FirecrawlScrapePage {
  url: string;
  markdown?: string;
  /** Cleaned HTML — Firecrawl removes scripts (including JSON-LD!) and
   *  some other "noise" tags. Suitable for content-depth + body parsing,
   *  NOT for schema/canonical/meta detection. */
  html?: string;
  /** Raw, unsanitized HTML — preserves <script type="application/ld+json">
   *  blocks, canonical link, meta tags, analytics snippets, etc. Use this
   *  for any AEO Page Health or detected-stack check that depends on
   *  head-level markup. Adam 2026-06-03: missing rawHtml caused all four
   *  on-page false negatives in the 255 Cal brief. */
  rawHtml?: string;
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
    statusCode?: number;
    [k: string]: unknown;
  };
}

export interface FirecrawlCrawlResult {
  jobId: string;
  status: string;
  total: number;
  completed: number;
  pages: FirecrawlScrapePage[];
}

export interface FirecrawlSearchResult {
  query: string;
  results: Array<{
    url: string;
    title?: string;
    description?: string;
    markdown?: string;
  }>;
}

function isConfigured(): boolean {
  return !!process.env.FIRECRAWL_API_KEY;
}

function authHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
  };
}

function notConfigured(): FirecrawlErr {
  return {
    ok: false,
    error: "FIRECRAWL_API_KEY not configured",
    skipped: true,
    reason: "FIRECRAWL_API_KEY not configured",
  };
}

async function scrapeUncached(args: {
  url: string;
  formats?: Array<"markdown" | "html" | "rawHtml" | "links">;
}): Promise<FirecrawlResult<FirecrawlScrapePage>> {
  if (!isConfigured()) return notConfigured();

  const formats = args.formats ?? ["markdown", "html"];
  try {
    const res = await fetch(`${BASE_URL}/scrape`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ url: args.url, formats }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const error = `firecrawl /scrape http ${res.status}: ${detail.slice(0, 200)}`;
      console.error("[firecrawl.scrape]", error);
      return { ok: false, error };
    }
    const body = (await res.json()) as {
      success?: boolean;
      data?: FirecrawlScrapePage;
    };
    const data = body.data ?? { url: args.url };
    const costUsd = COST_PER_PAGE_USD;
    return { ok: true, data, costUsd };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[firecrawl.scrape] request failed:", message);
    return { ok: false, error: `firecrawl scrape error: ${message}` };
  }
}

/**
 * POST /scrape — pulls a single URL as markdown + html.
 * Cached for 7 days keyed on (url, formats) so repeated discovery
 * passes don't burn through scrape budget. Bust via
 * `revalidateTag(firecrawlScrapeCacheTag(url))`.
 */
export async function scrape(args: {
  url: string;
  formats?: Array<"markdown" | "html" | "rawHtml" | "links">;
}): Promise<FirecrawlResult<FirecrawlScrapePage>> {
  const formats = args.formats ?? ["markdown", "html"];
  const cached = unstable_cache(
    async () => scrapeUncached({ url: args.url, formats }),
    ["firecrawl-scrape", args.url, formats.join(",")],
    {
      revalidate: FIRECRAWL_SCRAPE_CACHE_TTL_SECONDS,
      tags: [firecrawlScrapeCacheTag(args.url)],
    },
  );
  return cached();
}

/**
 * POST /crawl — kicks off a crawl job, polls until complete or timeout.
 * Returns the aggregated pages plus the jobId + final status.
 *
 * Timeout: 90s. After that we return whatever has been collected so far with
 * status "in_progress" — callers can choose to persist a partial result.
 */
export async function crawl(args: {
  url: string;
  limit: number;
  includePaths?: string[];
  excludePaths?: string[];
}): Promise<FirecrawlResult<FirecrawlCrawlResult>> {
  if (!isConfigured()) return notConfigured();

  const startedAt = Date.now();
  const TIMEOUT_MS = 90_000;
  const POLL_INTERVAL_MS = 3_000;

  try {
    const initRes = await fetch(`${BASE_URL}/crawl`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        url: args.url,
        limit: args.limit,
        includePaths: args.includePaths,
        excludePaths: args.excludePaths,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });
    if (!initRes.ok) {
      const detail = await initRes.text().catch(() => "");
      const error = `firecrawl /crawl http ${initRes.status}: ${detail.slice(0, 200)}`;
      console.error("[firecrawl.crawl]", error);
      return { ok: false, error };
    }
    const initBody = (await initRes.json()) as {
      success?: boolean;
      id?: string;
      url?: string;
    };
    const jobId = initBody.id;
    if (!jobId) {
      return { ok: false, error: "firecrawl /crawl returned no job id" };
    }

    // Poll until status === "completed" or timeout.
    while (Date.now() - startedAt < TIMEOUT_MS) {
      await sleep(POLL_INTERVAL_MS);
      const pollRes = await fetch(`${BASE_URL}/crawl/${jobId}`, {
        method: "GET",
        headers: authHeaders(),
      });
      if (!pollRes.ok) {
        // Transient — keep polling unless we've exhausted budget.
        const detail = await pollRes.text().catch(() => "");
        console.warn(
          `[firecrawl.crawl] poll http ${pollRes.status}: ${detail.slice(0, 200)}`,
        );
        continue;
      }
      const poll = (await pollRes.json()) as {
        status?: string;
        total?: number;
        completed?: number;
        data?: FirecrawlScrapePage[];
      };
      if (poll.status === "completed") {
        const pages = Array.isArray(poll.data) ? poll.data : [];
        const costUsd = pages.length * COST_PER_PAGE_USD;
        console.log(
          `[firecrawl.crawl] $${costUsd.toFixed(4)} ${args.url} ${pages.length} pages`,
        );
        return {
          ok: true,
          data: {
            jobId,
            status: "completed",
            total: poll.total ?? pages.length,
            completed: poll.completed ?? pages.length,
            pages,
          },
          costUsd,
        };
      }
      if (poll.status === "failed" || poll.status === "cancelled") {
        return {
          ok: false,
          error: `firecrawl crawl ${poll.status}`,
        };
      }
    }

    // Timeout — try one last poll to grab whatever's done so far.
    const finalRes = await fetch(`${BASE_URL}/crawl/${jobId}`, {
      method: "GET",
      headers: authHeaders(),
    });
    if (finalRes.ok) {
      const poll = (await finalRes.json()) as {
        status?: string;
        total?: number;
        completed?: number;
        data?: FirecrawlScrapePage[];
      };
      const pages = Array.isArray(poll.data) ? poll.data : [];
      const costUsd = pages.length * COST_PER_PAGE_USD;
      console.warn(
        `[firecrawl.crawl] timeout — partial $${costUsd.toFixed(4)} ${args.url} ${pages.length} pages`,
      );
      return {
        ok: true,
        data: {
          jobId,
          status: poll.status ?? "in_progress",
          total: poll.total ?? pages.length,
          completed: poll.completed ?? pages.length,
          pages,
        },
        costUsd,
      };
    }
    return { ok: false, error: "firecrawl crawl timeout" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[firecrawl.crawl] request failed:", message);
    return { ok: false, error: `firecrawl crawl error: ${message}` };
  }
}

async function searchUncached(args: {
  query: string;
  limit?: number;
}): Promise<FirecrawlResult<FirecrawlSearchResult>> {
  if (!isConfigured()) return notConfigured();

  const limit = args.limit ?? 5;
  try {
    const res = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ query: args.query, limit }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const error = `firecrawl /search http ${res.status}: ${detail.slice(0, 200)}`;
      console.error("[firecrawl.search]", error);
      return { ok: false, error };
    }
    const body = (await res.json()) as {
      success?: boolean;
      data?: Array<{
        url: string;
        title?: string;
        description?: string;
        markdown?: string;
      }>;
    };
    const results = Array.isArray(body.data) ? body.data : [];
    const costUsd = COST_PER_SEARCH_USD;
    return {
      ok: true,
      data: { query: args.query, results },
      costUsd,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[firecrawl.search] request failed:", message);
    return { ok: false, error: `firecrawl search error: ${message}` };
  }
}

/**
 * POST /search — Firecrawl-powered web search. Used by upstream callers for
 * cornerstone-page discovery when sitemap doesn't surface enough URLs.
 * Cached for 7 days — search-result URLs for cornerstone discovery are
 * extremely stable per (query, limit). Bust via
 * `revalidateTag(firecrawlSearchCacheTag())`.
 */
export async function search(args: {
  query: string;
  limit?: number;
}): Promise<FirecrawlResult<FirecrawlSearchResult>> {
  const limit = args.limit ?? 5;
  const cached = unstable_cache(
    async () => searchUncached({ query: args.query, limit }),
    ["firecrawl-search", args.query, String(limit)],
    {
      revalidate: FIRECRAWL_SEARCH_CACHE_TTL_SECONDS,
      tags: [firecrawlSearchCacheTag()],
    },
  );
  return cached();
}

export function isFirecrawlConfigured(): boolean {
  return isConfigured();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
