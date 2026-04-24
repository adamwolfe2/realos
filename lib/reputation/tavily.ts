import "server-only";
import type { ScanSourceResult, ScannedMention, PropertySeed } from "./types";
import { MentionSource } from "@prisma/client";

// ---------------------------------------------------------------------------
// Tavily — our unified source for everything except native Google Reviews.
//
// PRINCIPLES (tuned against real Telegraph Commons scan results, 2026-04):
//   1. Target REVIEW-CAPABLE domains only. Listings (realtor, rent.com,
//      trulia, zillow, apartmentguide base pages, rentcollegepads) get
//      hard-excluded — they're property-owned or syndicated listings, not
//      user reviews.
//   2. Own-social-media pages (instagram.com/{slug}, facebook.com/{slug},
//      twitter.com/{slug}) get filtered post-fetch.
//   3. Post-filter by CONTENT shape: a result without first-person voice or
//      review language is almost certainly a listing even when it slipped
//      through the domain filter.
//   4. Post-filter by URL shape: paths like /listings/, /rentals/details/,
//      /a/Property-Name-12345/, /search?, /biz/?find= are never reviews.
//   5. Post-filter by KEYWORD match: the excerpt must contain the property
//      name literally. Tavily's relevance ranking is too loose without
//      this — we saw "2414 Telegraph" and "2850 Telegraph Ave" matches for
//      a "Telegraph Commons" query.
// ---------------------------------------------------------------------------

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

// Cost accounting — ~$0.008 per advanced search call.
export const TAVILY_COST_CENTS_PER_QUERY = 1;

// Fixed count for predictable cost accounting.
export const TAVILY_QUERIES_PER_SCAN = 4;

// Hard-blocked domains — listings, syndicated aggregators, property-owned.
// We pass these to Tavily as exclude_domains on every query so the budget
// isn't wasted fetching them. Also exported so orchestrate.ts can sweep
// pre-existing PropertyMention rows whose host now falls on this list.
export const LISTING_BLOCKLIST = [
  "realtor.com",
  "rent.com",
  "rentable.co",
  "rentcafe.com",
  "rentcollegepads.com",
  "apartmentguide.com",
  "apartments.com", // mostly listings; reviews are thin and often astroturfed
  "trulia.com",
  "zillow.com",
  "forrentuniversity.com",
  "apartmentlist.com",
  "hotpads.com",
  "padmapper.com",
  "rentberry.com",
  "zumper.com",
  "streeteasy.com",
  "rentprogress.com",
  // Property-management vendor microsites that syndicate listings under
  // "Reviews" headers without actual user reviews (e.g. properties.tbgpm.com).
  "tbgpm.com",
  // Corporate / press release noise
  "prnewswire.com",
  "businesswire.com",
];

// Review-capable domains — real user voices live here.
const REVIEW_AGGREGATORS = [
  "yelp.com",
  "apartmentratings.com",
  "niche.com",
  "bbb.org",
  "glassdoor.com", // sometimes has resident reviews for owned REITs
  "tripadvisor.com", // relevant for some commercial/hospitality properties
];

// College + student discussion forums.
const COLLEGE_FORUMS = [
  "collegeconfidential.com",
  "quora.com",
  "medium.com",
  "berkeley.edu",
  "ucla.edu",
  "usc.edu",
  "stanford.edu",
  "ucdavis.edu",
  "ucsd.edu",
  "ucsb.edu",
];

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
  includeDomains: string[] | undefined,
  excludeDomains: string[],
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
      ...(excludeDomains.length > 0
        ? { exclude_domains: excludeDomains }
        : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tavily ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as TavilyResponse;
  return json.results ?? [];
}

// Classify hostnames into MentionSource so the UI filter + per-source
// branding work. Unknown hosts keep TAVILY_WEB as a catch-all.
function classifySource(url: string): MentionSource {
  try {
    const host = new URL(url).host.toLowerCase();
    if (/(^|\.)reddit\.com$/.test(host)) return MentionSource.REDDIT;
    if (/(^|\.)yelp\.com$/.test(host)) return MentionSource.YELP;
    if (
      /(^|\.)google\.com$/.test(host) ||
      /(^|\.)maps\.google\.com$/.test(host)
    ) {
      return MentionSource.GOOGLE_REVIEW;
    }
    if (/(^|\.)facebook\.com$/.test(host)) return MentionSource.FACEBOOK_PUBLIC;
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

function buildQueryPlan(property: PropertySeed): Array<{
  query: string;
  includeDomains?: string[];
  maxResults?: number;
  label: string;
}> {
  const name = property.name;
  const loc = [property.city, property.state].filter(Boolean).join(", ");
  const locSuffix = loc ? ` ${loc}` : "";

  return [
    // 1. Reddit — discussion threads containing exact property name.
    {
      query: `"${name}"${locSuffix}`,
      includeDomains: ["reddit.com"],
      maxResults: 10,
      label: "reddit",
    },
    // 2. Review aggregators — Yelp, ApartmentRatings, Niche, BBB, Glassdoor.
    {
      query: `"${name}"${locSuffix}`,
      includeDomains: REVIEW_AGGREGATORS,
      maxResults: 10,
      label: "aggregators",
    },
    // 3. College + student discussion forums.
    {
      query: `"${name}"${locSuffix}`,
      includeDomains: COLLEGE_FORUMS,
      maxResults: 10,
      label: "forums",
    },
    // 4. Strong-signal language — broad crawl (no domain filter) but with
    // extreme language that's a reliable proxy for user-review content.
    // The listing blocklist applied via exclude_domains keeps this narrow.
    {
      query: `"${name}"${locSuffix} (review OR reviews OR avoid OR scam OR worst OR "do not rent" OR horrible OR "stay away" OR recommend OR "best apartment" OR "loved living" OR "lived here")`,
      maxResults: 10,
      label: "strong_signals",
    },
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

  const plan = buildQueryPlan(property);
  const ownedDomains = deriveOwnedDomains(property);
  const ownedSocialPaths = deriveOwnedSocialPaths(property);
  const excludeDomains = [...LISTING_BLOCKLIST, ...ownedDomains];

  try {
    const settled = await Promise.allSettled(
      plan.map((p) =>
        tavilySearch(
          apiKey,
          p.query,
          p.includeDomains,
          excludeDomains,
          p.maxResults
        )
      )
    );

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
        if (isOwnedSocialPage(r.url, ownedSocialPaths)) continue;
        if (isListingUrl(r.url)) continue;
        if (isWrongBusinessPage(r.url, property.name)) continue;
        const mention = toScannedMention(r);
        if (!mentionLooksLikeReview(mention, property.name)) continue;
        seen.set(r.url, mention);
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

// ---------------------------------------------------------------------------
// Filter helpers.
// ---------------------------------------------------------------------------

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

// Likely-owned website domains inferred from the property name + Google review
// URL.
export function deriveOwnedDomains(property: PropertySeed): string[] {
  const domains = new Set<string>();
  const slug = slugifyName(property.name);
  if (slug.length >= 3) {
    for (const tld of [".com", ".co", ".net", ".io", ".org"]) {
      domains.add(slug + tld);
    }
  }
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

// Social-media paths under shared platforms that the property itself operates:
// instagram.com/telegraphcommonsberkeley, facebook.com/telegraphcommons, etc.
export function deriveOwnedSocialPaths(property: PropertySeed): string[] {
  const slug = slugifyName(property.name);
  if (slug.length < 3) return [];
  const variants = [slug, `${slug}berkeley`, `${slug}apartments`];
  const paths: string[] = [];
  for (const host of [
    "instagram.com",
    "facebook.com",
    "m.facebook.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "linkedin.com",
    "youtube.com",
  ]) {
    for (const v of variants) {
      paths.push(`${host}/${v}`);
      paths.push(`${host}/@${v}`);
    }
  }
  return paths;
}

export function isOwnedHost(url: string, ownedDomains: string[]): boolean {
  if (ownedDomains.length === 0) return false;
  try {
    const host = new URL(url).host.toLowerCase().replace(/^www\./, "");
    return ownedDomains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export function isOwnedSocialPage(url: string, ownedSocialPaths: string[]): boolean {
  if (ownedSocialPaths.length === 0) return false;
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.toLowerCase();
    for (const p of ownedSocialPaths) {
      const [pHost, ...pRest] = p.split("/");
      const pPath = "/" + pRest.join("/");
      if (host === pHost && (path === pPath || path.startsWith(pPath + "/"))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// URL path patterns that are never user reviews: listing detail pages,
// search result pages, syndicated availability pages.
export function isListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const search = u.search.toLowerCase();
    // /a/{Name}-{number}/ is ApartmentGuide/Apartments.com listing detail.
    if (/\/a\/[^/]+-\d{5,}/.test(path)) return true;
    // /rentals/details/, /listings/, /apartment/, /rent/ etc.
    if (/\/(rentals|listings|listing|apartment|rent)\/[^/]+/.test(path))
      return true;
    // /city/{state}/listings/, /for-rent/
    if (/\/for-rent\//.test(path)) return true;
    // Yelp search result pages and redirects
    if (/\/search/.test(path) && search.includes("find_")) return true;
    if (path === "/search") return true;
    if (/\/biz_redir/.test(path)) return true;
    // Prospect ratings / syndicated review-looking pages from PM vendors
    if (/prospect-ratings/.test(path)) return true;
    // Government / municipal PDFs
    if (path.endsWith(".pdf")) return true;
    return false;
  } catch {
    return false;
  }
}

// Wrong-business filter for sites with business-slug URLs. Yelp's biz pages
// show "nearby" links to other local businesses; Tavily picks those up when
// the property name appears in the page copy, even though the page itself
// is for a DIFFERENT business. We require the URL's business slug to
// contain the property name tokens.
export function isWrongBusinessPage(url: string, propertyName: string): boolean {
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.toLowerCase();

    const propertyTokens = propertyName
      .toLowerCase()
      .split(/[\s&]+/)
      .filter((t) => t.length >= 3);
    if (propertyTokens.length === 0) return false;

    // Yelp: /biz/{slug}
    if (/(^|\.)yelp\.com$/.test(host)) {
      const m = path.match(/^\/biz\/([^/]+)/);
      if (m) {
        const slug = m[1];
        // Every significant token in the property name must appear in the slug
        return !propertyTokens.every((t) => slug.includes(t));
      }
    }

    // Niche: /places-to-live/{slug}/
    if (/(^|\.)niche\.com$/.test(host)) {
      const m = path.match(/\/places-to-live\/([^/]+)/);
      if (m) {
        const slug = m[1];
        return !propertyTokens.every((t) => slug.includes(t));
      }
    }

    // ApartmentRatings: /ca/{city}/{slug}/
    if (/(^|\.)apartmentratings\.com$/.test(host)) {
      const m = path.match(/\/[a-z]{2}\/[^/]+\/([^/]+)/);
      if (m) {
        const slug = m[1];
        return !propertyTokens.every((t) => slug.includes(t));
      }
    }

    return false;
  } catch {
    return false;
  }
}

// Content-level filter — requires the excerpt to contain the property name
// AND to read more like a review than a listing. Listings have telltale
// phrasing ("LEASING FOR FALL", "Apply Now", "### More about", "Find Homes
// on the go!", phone numbers prefixed with markdown headers).
function mentionLooksLikeReview(
  m: ScannedMention,
  propertyName: string
): boolean {
  const text = `${m.title ?? ""} ${m.excerpt ?? ""}`;
  const textLower = text.toLowerCase();
  const nameLower = propertyName.toLowerCase();

  // Must literally mention the property name — Tavily's relevance ranking
  // sometimes surfaces adjacent-address matches ("2414 Telegraph", "near
  // 2850 Telegraph Ave") that don't actually reference the target property.
  if (!textLower.includes(nameLower)) return false;

  // Reddit, Yelp, ApartmentRatings, BBB, Niche, CollegeConfidential, Quora
  // pages are trusted even with minimal text (thread titles often suffice).
  const alwaysTrust = /(^|\.)(reddit|yelp|apartmentratings|bbb|niche|collegeconfidential|quora)\.com$/;
  try {
    const host = new URL(m.sourceUrl).host.toLowerCase().replace(/^www\./, "");
    if (alwaysTrust.test(host)) return true;
  } catch {
    // fall through
  }

  // Reject listing-style content everywhere else.
  const listingTells = [
    "leasing for fall",
    "apply now",
    "schedule a tour",
    "schedule tour",
    "find homes on the go",
    "## description",
    "### more about",
    "## availability",
    "floor plans",
    "available at",
    "all utilities included",
    "### amenities",
    "### features",
    "## pricing",
    "shared & private dorm",
  ];
  for (const tell of listingTells) {
    if (textLower.includes(tell)) return false;
  }

  // Reward review-style content — first-person voice, staff/management
  // references, experience language.
  const reviewTells = [
    " i lived ",
    " i live ",
    " we lived ",
    " we stayed ",
    " my apartment",
    " my stay",
    " the staff",
    " management was",
    " maintenance was",
    " maintenance is",
    "months ago",
    "year ago",
    " been here",
    " lived here",
    " moved in",
    " moved out",
    " would recommend",
    " would not recommend",
    " do not recommend",
    " avoid ",
    " scam ",
    " worst ",
    " horrible ",
    " amazing ",
    " loved living",
    " love living",
    " great place",
    " bad place",
  ];
  for (const tell of reviewTells) {
    if (textLower.includes(tell)) return true;
  }

  // Default for non-trusted hosts without strong review signal: drop.
  return false;
}
