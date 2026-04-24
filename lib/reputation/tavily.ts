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

// How many parallel Tavily queries per scan. Kept in one place so the cost
// estimator in orchestrate.ts stays in sync. Count is fixed for budget
// predictability; buildQueryPlan returns this many query specs every time.
export const TAVILY_QUERIES_PER_SCAN = 7;

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
  includeDomains?: string[],
  maxResults = 10
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
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
      ...(includeDomains && includeDomains.length > 0
        ? { include_domains: includeDomains }
        : {}),
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

// Tavily is our unified source for everything except native Google Reviews.
// The property name is ALWAYS quoted (`"${name}"`) so Tavily requires an
// exact-phrase match — this is the user's #1 requirement: every mention
// must contain the literal property keyword.
//
// Each query targets a different slice of the web. We use `include_domains`
// where supported — it's more reliable than `site:` operators in the query
// string — and leave it unset for broad crawls.
function buildQueryPlan(property: PropertySeed): Array<{
  query: string;
  includeDomains?: string[];
  maxResults?: number;
  label?: string;
}> {
  const name = property.name;
  const loc = [property.city, property.state].filter(Boolean).join(", ");
  const locSuffix = loc ? ` ${loc}` : "";
  const isStudentHousing = property.residentialSubtype === "STUDENT_HOUSING";

  // Query 5 specializes based on property type. Student housing surfaces the
  // most intent on college forums + subreddits; general multifamily cares
  // more about tenant/landlord language.
  const contextQuery = isStudentHousing
    ? `"${name}"${locSuffix} (dorm OR "student housing" OR roommate OR campus OR college OR university)`
    : `"${name}"${locSuffix} (tenants OR residents OR "living at" OR "lived at" OR landlord OR lease)`;

  return [
    // 1. Reddit — subreddits mentioning the exact property name. Tavily's
    // relevance ranking inside reddit.com surfaces the most-upvoted threads
    // containing the phrase first, which is exactly what we want.
    {
      query: `"${name}"${locSuffix}`,
      includeDomains: ["reddit.com"],
      maxResults: 10,
      label: "reddit",
    },
    // 2. Facebook — public posts, pages, groups.
    {
      query: `"${name}"${locSuffix}`,
      includeDomains: ["facebook.com"],
      maxResults: 5,
      label: "facebook",
    },
    // 3. College + student forums — where prospective tenants compare options.
    // Especially critical for student housing; still useful for any property
    // near a campus.
    {
      query: `"${name}"${locSuffix}`,
      includeDomains: [
        "collegeconfidential.com",
        "quora.com",
        "medium.com",
        "ucdavis.edu",
        "berkeley.edu",
        "ucla.edu",
        "usc.edu",
        "stanford.edu",
      ],
      maxResults: 10,
      label: "college_forums",
    },
    // 4. Dedicated apartment + review aggregators.
    {
      query: `"${name}"${locSuffix}`,
      includeDomains: [
        "apartments.com",
        "apartmentratings.com",
        "niche.com",
        "yelp.com",
        "bbb.org",
        "rentcafe.com",
        "trulia.com",
        "zillow.com",
        "rent.com",
      ],
      maxResults: 10,
      label: "aggregators",
    },
    // 5. General web — "reviews" intent, broad crawl.
    {
      query: `"${name}"${locSuffix} reviews`,
      maxResults: 10,
      label: "reviews_intent",
    },
    // 6. Strong-signal language — catches extreme opinions (rave or rant)
    // that the generic "reviews" query often misses. Quoted name enforces
    // keyword match; the OR chain expands recall across sentiment polarity.
    {
      query: `"${name}"${locSuffix} (avoid OR scam OR worst OR "do not rent" OR horrible OR "stay away" OR recommend OR "best apartment" OR love OR amazing)`,
      maxResults: 10,
      label: "strong_signals",
    },
    // 7. Resident / context query, tailored by property type.
    {
      query: contextQuery,
      maxResults: 10,
      label: "context",
    },
  ];
}

function deriveOwnedDomains(property: PropertySeed): string[] {
  const domains = new Set<string>();
  // Heuristic 1: slugified property name + common TLDs. Catches "Telegraph
  // Commons" → telegraphcommons.com. Breaks for compound names with periods
  // but that's a rare edge case.
  const slug = property.name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
  if (slug.length >= 3) {
    for (const tld of [".com", ".co", ".net", ".io", ".org"]) {
      domains.add(slug + tld);
    }
  }
  // Heuristic 2: extract domain from googleReviewUrl if it points at the
  // property's own site rather than maps.google.com.
  if (property.googleReviewUrl) {
    try {
      const host = new URL(property.googleReviewUrl).host
        .toLowerCase()
        .replace(/^www\./, "");
      if (
        !host.includes("google.com") &&
        !host.includes("maps.google") &&
        !host.includes("yelp.com")
      ) {
        domains.add(host);
      }
    } catch {
      // ignore malformed URLs
    }
  }
  return Array.from(domains);
}

function isOwnedHost(url: string, ownedDomains: string[]): boolean {
  if (ownedDomains.length === 0) return false;
  try {
    const host = new URL(url).host.toLowerCase().replace(/^www\./, "");
    return ownedDomains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
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

  const plan = buildQueryPlan(property);
  // Heuristic self-site filter — a property's own marketing website isn't a
  // "mention" from someone else, even if it matches the exact-phrase query.
  // We derive the likely owned domains from the property name + googleReviewUrl
  // and exclude any result whose host matches.
  const ownedDomains = deriveOwnedDomains(property);

  try {
    const settled = await Promise.allSettled(
      plan.map((p) =>
        tavilySearch(apiKey, p.query, p.includeDomains, p.maxResults)
      )
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
        if (isOwnedHost(r.url, ownedDomains)) continue;
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
