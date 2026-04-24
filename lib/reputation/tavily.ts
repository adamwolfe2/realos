import "server-only";
import type { ScanSourceResult, ScannedMention, PropertySeed } from "./types";
import { MentionSource } from "@prisma/client";

// ---------------------------------------------------------------------------
// Tavily web search — the workhorse source. Runs three parallel queries per
// scan to cover general web, Reddit, and common review aggregators. Each
// result is classified into a MentionSource by hostname so dedupe works
// across sources (a Reddit thread surfaced by both Tavily and the Reddit API
// direct search collapses to one PropertyMention row).
//
// No dedicated SDK dep: we call the public REST endpoint directly. The
// official @tavily/core client is a thin wrapper and adds an install we
// don't need.
// ---------------------------------------------------------------------------

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

// Cost accounting — tuned to Tavily advanced-search pricing at time of build.
// See docs (and update if pricing changes) — used purely for cost telemetry
// on ReputationScan.estCostCents, not for billing.
export const TAVILY_COST_CENTS_PER_QUERY = 1; // round up: ~$0.008 basic, ~$0.012 advanced

type TavilyResult = {
  url: string;
  title?: string;
  content?: string;
  raw_content?: string | null;
  published_date?: string | null;
  score?: number;
};

type TavilyResponse = {
  answer?: string;
  query?: string;
  results?: TavilyResult[];
};

async function tavilySearch(
  apiKey: string,
  query: string,
  includeDomains?: string[]
): Promise<TavilyResult[]> {
  const res = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      max_results: 10,
      include_answer: false,
      include_raw_content: false,
      include_domains: includeDomains,
    }),
    // Tavily can be slow on advanced depth; give it 15s before we abort.
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tavily ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as TavilyResponse;
  return json.results ?? [];
}

function classifySource(url: string): MentionSource {
  try {
    const host = new URL(url).host.toLowerCase();
    if (/(^|\.)reddit\.com$/.test(host)) return MentionSource.REDDIT;
    if (/(^|\.)yelp\.com$/.test(host)) return MentionSource.YELP;
    if (
      host === "google.com" ||
      /(^|\.)google\.com$/.test(host) ||
      /(^|\.)maps\.google\.com$/.test(host)
    ) {
      return MentionSource.GOOGLE_REVIEW;
    }
    if (
      host === "facebook.com" ||
      /(^|\.)facebook\.com$/.test(host) ||
      host === "m.facebook.com"
    ) {
      return MentionSource.FACEBOOK_PUBLIC;
    }
    return MentionSource.TAVILY_WEB;
  } catch {
    return MentionSource.TAVILY_WEB;
  }
}

function toScannedMention(r: TavilyResult): ScannedMention {
  const excerpt = (r.content ?? r.raw_content ?? r.title ?? "").slice(0, 1200);
  return {
    source: classifySource(r.url),
    sourceUrl: r.url,
    title: r.title ?? null,
    excerpt,
    authorName: null,
    publishedAt: r.published_date ? new Date(r.published_date) : null,
    rating: null,
  };
}

function buildQueries(property: PropertySeed): string[] {
  const name = property.name;
  const loc = [property.city, property.state].filter(Boolean).join(", ");
  const locSuffix = loc ? ` ${loc}` : "";
  return [
    `"${name}"${locSuffix} reviews`,
    `"${name}" reddit`,
    `"${name}" apartments.com OR apartmentratings.com OR niche.com OR yelp.com OR bbb.org`,
  ];
}

export async function searchTavily(
  property: PropertySeed
): Promise<ScanSourceResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      source: "tavily",
      ok: false,
      found: 0,
      mentions: [],
      error: "TAVILY_API_KEY not configured",
    };
  }

  const queries = buildQueries(property);
  try {
    const settled = await Promise.allSettled(
      queries.map((q) => tavilySearch(apiKey, q))
    );

    // Aggregate results across queries. Tavily can return the same URL from
    // multiple queries; dedupe by raw URL here so we don't over-report
    // `found`. Final cross-source dedupe happens in orchestrate.ts via
    // urlHash.
    const seen = new Map<string, ScannedMention>();
    let firstError: string | undefined;

    for (const s of settled) {
      if (s.status === "rejected") {
        firstError = firstError ?? String(s.reason?.message ?? s.reason);
        continue;
      }
      for (const r of s.value) {
        if (!r.url) continue;
        if (seen.has(r.url)) continue;
        seen.set(r.url, toScannedMention(r));
      }
    }

    const mentions = Array.from(seen.values());
    const ok = mentions.length > 0 || !firstError;
    return {
      source: "tavily",
      ok,
      found: mentions.length,
      mentions,
      error: firstError,
    };
  } catch (err) {
    return {
      source: "tavily",
      ok: false,
      found: 0,
      mentions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
