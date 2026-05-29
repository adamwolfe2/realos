import "server-only";

// ----------------------------------------------------------------------------
// Reputation scanner for the PROSPECT audit lead-magnet.
//
// Unlike the tenant reputation flow (lib/reputation/orchestrate.ts) which
// requires a Property row + persisted PropertyMention writes, the prospect
// path is fire-once-and-render. We accept just { brandName, domain } and
// return a normalized payload the audit synthesizer can drop into the
// findings JSON.
//
// Sources:
//   1. Tavily — broad web crawl on review-capable domains. Filtered to last
//      90 days via the `days` query param (Tavily supports it). This is the
//      core "past 3 months" signal the CEO called out.
//   2. Reddit — direct JSON search, `t=year` window. We post-filter to the
//      last 90 days.
//   3. Yelp — skipped (no Yelp business ID for a prospect; we'd need a text
//      search step that costs more than the lead magnet is worth).
//   4. Google Places — skipped for the same reason; we don't have a Place
//      ID for an arbitrary prospect domain.
//
// Defensive: every source wrapped in try/catch returning empty so one
// failure doesn't tank the whole report.
// ----------------------------------------------------------------------------

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const REDDIT_ENDPOINT = "https://www.reddit.com/search.json";
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export type ProspectMention = {
  source:
    | "REDDIT"
    | "YELP"
    | "BBB"
    | "APARTMENT_RATINGS"
    | "FACEBOOK"
    | "GOOGLE_REVIEW"
    | "TAVILY_WEB";
  title: string | null;
  snippet: string;
  url: string;
  publishedAt: string | null; // ISO
  sentiment?: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED" | null;
  themes?: string[];
};

export type ProspectReputationResult = {
  totalMentions: number;
  mentions: ProspectMention[];
  sentimentMix: { positive: number; neutral: number; negative: number };
  avgRating: number | null;
  // Per-source diagnostics so the synthesizer can attribute failures.
  errors: Record<string, string | null>;
};

const REVIEW_INCLUDE_DOMAINS = [
  "reddit.com",
  "yelp.com",
  "apartmentratings.com",
  "niche.com",
  "bbb.org",
  "facebook.com",
  "tripadvisor.com",
];

// Source classifier — matches what the viewer renders per-icon.
function classify(url: string): ProspectMention["source"] {
  try {
    const host = new URL(url).host.toLowerCase();
    if (/(^|\.)reddit\.com$/.test(host)) return "REDDIT";
    if (/(^|\.)yelp\.com$/.test(host)) return "YELP";
    if (/(^|\.)bbb\.org$/.test(host)) return "BBB";
    if (/(^|\.)apartmentratings\.com$/.test(host)) return "APARTMENT_RATINGS";
    if (/(^|\.)facebook\.com$/.test(host)) return "FACEBOOK";
    if (/(^|\.)google\.com$/.test(host)) return "GOOGLE_REVIEW";
    return "TAVILY_WEB";
  } catch {
    return "TAVILY_WEB";
  }
}

type TavilyResult = {
  url: string;
  title?: string;
  content?: string;
  published_date?: string | null;
};

async function tavilyReviewSearch(
  apiKey: string,
  query: string,
  excludeDomain: string,
  maxResults: number,
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
      topic: "general",
      // 90-day recency window — directly addresses the CEO's "past 3 months"
      // requirement. Tavily honors `days` on the general topic.
      days: 90,
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
      include_domains: REVIEW_INCLUDE_DOMAINS,
      // Exclude the prospect's own domain — we don't want self-cites.
      exclude_domains: [excludeDomain],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tavily ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { results?: TavilyResult[] };
  return json.results ?? [];
}

type RedditChild = {
  data: {
    title?: string;
    selftext?: string;
    permalink?: string;
    url?: string;
    created_utc?: number;
    author?: string;
    stickied?: boolean;
    over_18?: boolean;
  };
};

async function redditSearch(query: string): Promise<RedditChild[]> {
  const url = new URL(REDDIT_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "new");
  url.searchParams.set("t", "year");
  url.searchParams.set("limit", "10");
  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "LeaseStack-Audit/1.0 (+https://leasestack.co)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    throw new Error(`Reddit ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { children?: RedditChild[] };
  };
  return json.data?.children ?? [];
}

function inLast90Days(iso: string | null | undefined): boolean {
  if (!iso) return true; // unknown date — keep it; Tavily already filtered by `days`.
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t <= NINETY_DAYS_MS;
}

function normalizeUrlForDedupe(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    // Drop common tracking params.
    const params = new URLSearchParams(u.search);
    for (const k of Array.from(params.keys())) {
      if (/^utm_|^fbclid$|^gclid$/.test(k)) params.delete(k);
    }
    u.search = params.toString() ? `?${params.toString()}` : "";
    return u.toString().toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

export async function runProspectReputation(input: {
  brandName: string;
  domain: string;
}): Promise<ProspectReputationResult> {
  const { brandName, domain } = input;
  const errors: Record<string, string | null> = {
    tavily: null,
    reddit: null,
  };

  const tavilyApiKey = process.env.TAVILY_API_KEY;
  const queryName = brandName.includes(" ") ? `"${brandName}"` : brandName;

  // --- Tavily fan-out (3 queries) -------------------------------------------
  const tavilyResults: TavilyResult[] = [];
  if (tavilyApiKey) {
    const queries = [
      `${queryName} reviews`,
      `${queryName} apartments`,
      `${queryName} reddit`,
    ];
    const settled = await Promise.allSettled(
      queries.map((q) => tavilyReviewSearch(tavilyApiKey, q, domain, 10)),
    );
    for (const s of settled) {
      if (s.status === "fulfilled") {
        tavilyResults.push(...s.value);
      } else if (!errors.tavily) {
        errors.tavily =
          s.reason instanceof Error ? s.reason.message : String(s.reason);
      }
    }
  } else {
    errors.tavily = "TAVILY_API_KEY not configured";
  }

  // --- Reddit fan-out (single query) ----------------------------------------
  let redditResults: RedditChild[] = [];
  try {
    redditResults = await redditSearch(queryName);
  } catch (err) {
    errors.reddit = err instanceof Error ? err.message : String(err);
  }

  // --- Normalize + dedupe ---------------------------------------------------
  const seen = new Set<string>();
  const mentions: ProspectMention[] = [];

  for (const r of tavilyResults) {
    if (!r.url) continue;
    const key = normalizeUrlForDedupe(r.url);
    if (seen.has(key)) continue;
    if (!inLast90Days(r.published_date)) continue;
    seen.add(key);
    const snippet = (r.content ?? "").slice(0, 400);
    mentions.push({
      source: classify(r.url),
      title: r.title ?? null,
      snippet,
      url: r.url,
      publishedAt: r.published_date ?? null,
      sentiment: lexicalSentimentForText(`${r.title ?? ""} ${snippet}`),
    });
  }

  for (const child of redditResults) {
    const d = child.data;
    if (!d || d.stickied || d.over_18 || !d.permalink) continue;
    const fullUrl = `https://www.reddit.com${d.permalink}`;
    const key = normalizeUrlForDedupe(fullUrl);
    if (seen.has(key)) continue;
    const publishedAt = d.created_utc
      ? new Date(d.created_utc * 1000).toISOString()
      : null;
    if (!inLast90Days(publishedAt)) continue;
    const title = d.title ?? null;
    const body = (d.selftext ?? "").trim();
    // Require the brand name to appear in title or body — Reddit's relevance
    // can be loose. Same defense as the tenant Reddit connector.
    const hay = `${title ?? ""} ${body}`.toLowerCase();
    if (!hay.includes(brandName.toLowerCase())) continue;
    seen.add(key);
    const snippet = body.slice(0, 400);
    mentions.push({
      source: "REDDIT",
      title,
      snippet,
      url: fullUrl,
      publishedAt,
      sentiment: lexicalSentimentForText(`${title ?? ""} ${snippet}`),
    });
  }

  // Sort by publishedAt DESC, undefined last.
  mentions.sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });

  // Cap at 40 mentions for the report — more than that is noise.
  const capped = mentions.slice(0, 40);

  // Sentiment mix is best-effort lexical (no LLM call in the prospect path
  // to keep cost down). The synthesize() layer can re-classify if needed.
  const sentimentMix = lexicalSentimentMix(capped);

  return {
    totalMentions: capped.length,
    mentions: capped,
    sentimentMix,
    avgRating: null,
    errors,
  };
}

// Per-mention lexical sentiment — mirrors the tells used in the aggregate
// mix below. Returns null when both pos+neg tells fire (mixed signal) so
// the viewer doesn't render a misleading dot. The tenant path uses a
// Haiku classifier; the prospect path stays lexical for cost reasons.
function lexicalSentimentForText(
  text: string,
): "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED" {
  const hay = text.toLowerCase();
  const positiveTells =
    /(love|loved|great|amazing|recommend|fantastic|excellent|awesome|perfect|wonderful|5 stars|five stars)/i;
  const negativeTells =
    /(avoid|scam|worst|horrible|terrible|do not rent|stay away|disgusting|nightmare|complain|complaint|roach|mold|broken|unresponsive|rude|filthy|dirty)/i;
  const isNeg = negativeTells.test(hay);
  const isPos = positiveTells.test(hay);
  if (isPos && isNeg) return "MIXED";
  if (isPos) return "POSITIVE";
  if (isNeg) return "NEGATIVE";
  return "NEUTRAL";
}

// Tiny lexical sentiment heuristic — not a replacement for the Haiku
// classifier the tenant pipeline uses, but accurate enough to weight the
// reputation score for a prospect.
function lexicalSentimentMix(
  mentions: ProspectMention[],
): { positive: number; neutral: number; negative: number } {
  if (mentions.length === 0) return { positive: 0, neutral: 1, negative: 0 };
  const positiveTells =
    /(love|loved|great|amazing|recommend|fantastic|excellent|awesome|perfect|wonderful)/i;
  const negativeTells =
    /(avoid|scam|worst|horrible|terrible|do not rent|stay away|disgusting|nightmare|complain|complaint|roach|mold|broken|unresponsive)/i;
  let pos = 0;
  let neg = 0;
  for (const m of mentions) {
    const hay = `${m.title ?? ""} ${m.snippet}`.toLowerCase();
    const isNeg = negativeTells.test(hay);
    const isPos = positiveTells.test(hay);
    if (isNeg && !isPos) neg++;
    else if (isPos && !isNeg) pos++;
  }
  const neu = mentions.length - pos - neg;
  const total = mentions.length;
  const round = (n: number) => Math.round((n / total) * 100) / 100;
  return { positive: round(pos), neutral: round(neu), negative: round(neg) };
}

// Derive a human-readable brand name from a domain. "telegraphcommons.com"
// -> "Telegraph Commons". Heuristic — splits on common compound boundaries.
export function brandNameFromDomain(domain: string): string {
  const base = domain.replace(/\.[a-z]{2,}$/i, "").replace(/^www\./, "");
  // Try splitting on camelCase, then on common token boundaries.
  const tokens = base
    .split(/[-_.]+/)
    .flatMap((t) => splitCompound(t))
    .filter(Boolean)
    .map((t) => t[0].toUpperCase() + t.slice(1).toLowerCase());
  return tokens.join(" ");
}

// Compound-word splitter — best-effort split on common multifamily/real
// estate vocabulary. "telegraphcommons" -> ["telegraph", "commons"].
function splitCompound(token: string): string[] {
  const vocab = [
    "apartments",
    "apartment",
    "commons",
    "lofts",
    "residences",
    "tower",
    "towers",
    "house",
    "plaza",
    "place",
    "square",
    "park",
    "village",
    "heights",
    "lodge",
    "estates",
    "suites",
    "flats",
    "living",
    "homes",
    "rentals",
    "properties",
    "group",
    "realty",
  ];
  const lower = token.toLowerCase();
  for (const v of vocab) {
    if (lower.endsWith(v) && lower.length > v.length + 2) {
      return [lower.slice(0, lower.length - v.length), v];
    }
  }
  return [token];
}
