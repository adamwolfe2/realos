import "server-only";
import { MentionSource } from "@prisma/client";
import type { ScanSourceResult, ScannedMention, PropertySeed } from "./types";

// ---------------------------------------------------------------------------
// Reddit — direct connector for the public .json search endpoint.
//
// Background:
//   The orchestrator already pulls Reddit threads via Tavily (one query
//   bucket targets reddit.com). Tavily is great for full-text relevance but
//   it doesn't see brand-new posts or comments — its index lags by hours to
//   days. For the unified reputation inbox we want freshly-posted Reddit
//   chatter to surface inside the same scan run, so we hit Reddit's public
//   JSON endpoint directly.
//
// Endpoint:
//   GET https://www.reddit.com/search.json?q=<query>&sort=new&restrict_sr=
//
// Authentication:
//   Anonymous. Reddit allows ~60 requests/minute unauthenticated under their
//   /search.json fair-use policy, but the docs recommend 1 req/sec to stay
//   below abuse thresholds. We respect that with a `delay(1000)` between
//   queries.
//
// Behavior:
//   * Caps total results at 25 (Reddit returns up to 100, but our dedupe +
//     scoring + Haiku classification step doesn't benefit from more).
//   * Queries the property name in quotes plus the address as a fallback.
//     If `redditSubreddits` is configured on the Property, we also fan one
//     query per subreddit to catch hyper-local mentions (e.g.
//     subreddit:UCBerkeley for student-housing properties).
//   * Filters off-topic shape (sticky mod posts, AutoModerator, deleted
//     authors) so the analyzer never burns tokens on noise.
//   * Falls back gracefully — Reddit blocking shouldn't break the whole
//     scan. Returns ok=false with an error message; the orchestrator
//     records it on the ReputationScan row.
// ---------------------------------------------------------------------------

const REDDIT_ENDPOINT = "https://www.reddit.com/search.json";

// Hard cap. We could pull more, but the unified inbox is already crowded
// across all sources and Reddit volume tends to dominate when it's
// uncapped. Tuned against the 80-mention classifier batch upstream.
const MAX_RESULTS_PER_SCAN = 25;

// Per-query Reddit page size. The API returns 25 per page by default;
// we keep it tight so a single query can't blow past the cap.
const PAGE_SIZE = 10;

// Reddit's documented fair-use throttle for anonymous traffic. One second
// between calls keeps us well under their abuse threshold.
const INTER_QUERY_DELAY_MS = 1100;

// User-agent string. Reddit explicitly asks for a descriptive UA so admins
// can identify abusive callers. Required — anonymous traffic without a UA
// is heavily throttled.
const USER_AGENT = "LeaseStack-Reputation/1.0 (+https://leasestack.co)";

type RedditChildData = {
  id?: string;
  title?: string;
  selftext?: string;
  body?: string;
  url?: string;
  permalink?: string;
  author?: string;
  created_utc?: number;
  subreddit?: string;
  num_comments?: number;
  stickied?: boolean;
  removed_by_category?: string | null;
  over_18?: boolean;
};

type RedditChild = { kind: string; data: RedditChildData };

type RedditListing = {
  data?: {
    children?: RedditChild[];
  };
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchReddit(query: string, limit: number): Promise<RedditChild[]> {
  const url = new URL(REDDIT_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "new");
  url.searchParams.set("t", "year");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("restrict_sr", "");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    // 429 is by far the most common failure — surface it explicitly so
    // we can decide between "back off" and "Reddit is genuinely broken".
    throw new Error(
      res.status === 429
        ? `Reddit rate limit (429). Backing off — try again in a minute.`
        : `Reddit ${res.status}`,
    );
  }
  const json = (await res.json()) as RedditListing;
  return json.data?.children ?? [];
}

function buildQueries(property: PropertySeed): string[] {
  const queries: string[] = [];
  const name = property.name.trim();
  if (name) queries.push(`"${name}"`);

  // Address fallback. Helpful for newly-opened properties whose name
  // hasn't yet stuck in the local vernacular.
  const addrParts = [property.addressLine1, property.city]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .map((p) => p.trim());
  if (addrParts.length === 2) {
    queries.push(`"${addrParts.join(" ")}"`);
  }

  // Subreddit-scoped queries. Capped at 3 subreddits to keep total
  // request count predictable (1 + 1 + 3 = 5 queries × 1.1s delay = ~5s).
  if (property.redditSubreddits && property.redditSubreddits.length > 0) {
    const subs = property.redditSubreddits.slice(0, 3);
    for (const sub of subs) {
      const cleaned = sub.replace(/^r\//i, "").trim();
      if (cleaned) queries.push(`"${name}" subreddit:${cleaned}`);
    }
  }

  return queries;
}

function toMention(child: RedditChild): ScannedMention | null {
  const d = child.data;
  if (!d) return null;

  // Filter out noise that the analyzer would just waste tokens on.
  if (d.stickied) return null;
  if (!d.author || d.author === "[deleted]" || d.author === "AutoModerator") {
    return null;
  }
  if (d.removed_by_category) return null;
  // Skip NSFW threads — almost always irrelevant to a property's
  // reputation and operator-visible NSFW excerpts are a moderation risk.
  if (d.over_18) return null;

  const permalink = d.permalink ? `https://www.reddit.com${d.permalink}` : d.url;
  if (!permalink) return null;

  const title = d.title?.trim() || null;
  // Combine title + body. Reddit comment-typed children have body but no
  // title; post-typed children have title + selftext.
  const body = (d.selftext || d.body || "").trim();
  const excerpt = [title, body].filter(Boolean).join("\n\n").slice(0, 1200);
  if (!excerpt) return null;

  return {
    source: MentionSource.REDDIT,
    sourceUrl: permalink,
    title,
    excerpt,
    authorName: d.author ?? null,
    publishedAt: d.created_utc ? new Date(d.created_utc * 1000) : null,
    rating: null,
  };
}

export async function searchReddit(
  property: PropertySeed,
): Promise<ScanSourceResult> {
  const queries = buildQueries(property);
  if (queries.length === 0) {
    return {
      source: "reddit",
      ok: true,
      found: 0,
      mentions: [],
    };
  }

  const seen = new Map<string, ScannedMention>();
  let firstError: string | undefined;

  for (let i = 0; i < queries.length; i++) {
    if (seen.size >= MAX_RESULTS_PER_SCAN) break;
    const q = queries[i];

    // Honor Reddit's 1 req/sec fair-use guidance. We pause BEFORE each
    // request after the first — keeps the cumulative request rate at
    // ~1/s even when a query returns fast.
    if (i > 0) await delay(INTER_QUERY_DELAY_MS);

    try {
      const children = await fetchReddit(q, PAGE_SIZE);
      for (const child of children) {
        if (seen.size >= MAX_RESULTS_PER_SCAN) break;
        const mention = toMention(child);
        if (!mention) continue;
        // Per-property content must literally mention the property name.
        // The Tavily-side already enforces this; we repeat here because
        // subreddit:xyz queries are scoped by sub, not by content.
        const hay = `${mention.title ?? ""} ${mention.excerpt}`.toLowerCase();
        if (!hay.includes(property.name.toLowerCase())) continue;
        if (!seen.has(mention.sourceUrl)) {
          seen.set(mention.sourceUrl, mention);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      firstError = firstError ?? msg;
      // If we hit a 429 the smart move is to abort the rest of the
      // queries — additional calls just deepen the back-off window.
      if (/429/.test(msg)) break;
    }
  }

  const mentions = Array.from(seen.values());
  return {
    source: "reddit",
    // ok=true unless we got zero results AND saw an error. Otherwise we
    // surface what we did manage to pull.
    ok: mentions.length > 0 || !firstError,
    found: mentions.length,
    mentions,
    error: firstError,
  };
}
