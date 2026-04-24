import "server-only";
import { Redis } from "@upstash/redis";
import { MentionSource } from "@prisma/client";
import type { ScanSourceResult, ScannedMention, PropertySeed } from "./types";

// ---------------------------------------------------------------------------
// Reddit app-only OAuth2 client.
//
// Reddit's API is free for app-only (read-only) access. We use the
// client_credentials grant which gives us a 1-hour bearer token. We cache
// that token in Upstash KV for 55 minutes to avoid refreshing on every scan.
//
// User-Agent is mandatory — Reddit aggressively throttles default UAs.
// ---------------------------------------------------------------------------

const USER_AGENT = "leasestack:reputation-scanner:v1.0 (by /u/leasestack)";
const TOKEN_CACHE_KEY = "reputation:reddit:token";
const TOKEN_CACHE_TTL_SECONDS = 55 * 60; // 55m, Reddit tokens live for 60m

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

let inMemoryToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  // In-memory cache first (per-serverless-instance reuse).
  const now = Date.now();
  if (inMemoryToken && inMemoryToken.expiresAt > now + 30_000) {
    return inMemoryToken.value;
  }

  // KV cache next (shared across instances).
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<string>(TOKEN_CACHE_KEY);
      if (cached) {
        inMemoryToken = {
          value: cached,
          expiresAt: now + TOKEN_CACHE_TTL_SECONDS * 1000,
        };
        return cached;
      }
    } catch {
      // Non-fatal.
    }
  }

  // Fresh fetch.
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Reddit auth ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  const token = json.access_token;
  if (!token) throw new Error("Reddit auth missing access_token");

  inMemoryToken = {
    value: token,
    expiresAt: now + TOKEN_CACHE_TTL_SECONDS * 1000,
  };
  if (redis) {
    try {
      await redis.set(TOKEN_CACHE_KEY, token, { ex: TOKEN_CACHE_TTL_SECONDS });
    } catch {
      // Non-fatal.
    }
  }
  return token;
}

type RedditPost = {
  kind: string;
  data: {
    id: string;
    title?: string;
    selftext?: string;
    permalink?: string;
    url?: string;
    author?: string;
    subreddit?: string;
    created_utc?: number;
    over_18?: boolean;
  };
};

type RedditListing = {
  data?: { children?: RedditPost[] };
};

async function redditSearch(
  token: string,
  path: string,
  params: Record<string, string>
): Promise<RedditPost[]> {
  const qs = new URLSearchParams({ ...params, raw_json: "1" });
  const res = await fetch(`https://oauth.reddit.com${path}?${qs.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Reddit rate limit (429)");
    const body = await res.text().catch(() => "");
    throw new Error(`Reddit ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as RedditListing;
  return json.data?.children ?? [];
}

function toScannedMention(p: RedditPost): ScannedMention {
  const d = p.data;
  const permalink = d.permalink ? `https://www.reddit.com${d.permalink}` : d.url;
  const excerpt = (d.selftext ?? d.title ?? "").slice(0, 1200);
  const publishedAt = d.created_utc
    ? new Date(d.created_utc * 1000)
    : null;
  return {
    source: MentionSource.REDDIT,
    sourceUrl: permalink ?? "",
    title: d.title ?? null,
    excerpt,
    authorName: d.author ?? null,
    publishedAt,
    rating: null,
  };
}

export async function searchReddit(
  property: PropertySeed
): Promise<ScanSourceResult> {
  let token: string | null = null;
  try {
    token = await getAccessToken();
  } catch (err) {
    return {
      source: "reddit",
      ok: false,
      found: 0,
      mentions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
  if (!token) {
    return {
      source: "reddit",
      ok: false,
      found: 0,
      mentions: [],
      error: "REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not configured",
    };
  }

  const queries: Array<() => Promise<RedditPost[]>> = [];
  const name = property.name;

  // Global search.
  queries.push(() =>
    redditSearch(token as string, "/search.json", {
      q: `"${name}"`,
      sort: "new",
      limit: "25",
      type: "link",
      restrict_sr: "false",
    })
  );

  // Scoped searches per configured subreddit (if any).
  const subs = Array.isArray(property.redditSubreddits)
    ? property.redditSubreddits.filter(
        (s): s is string => typeof s === "string" && s.length > 0
      )
    : [];
  for (const sub of subs.slice(0, 5)) {
    queries.push(() =>
      redditSearch(
        token as string,
        `/r/${encodeURIComponent(sub)}/search.json`,
        {
          q: `"${name}"`,
          sort: "new",
          limit: "25",
          restrict_sr: "on",
        }
      )
    );
  }

  try {
    const settled = await Promise.allSettled(queries.map((fn) => fn()));
    const seen = new Map<string, ScannedMention>();
    let firstError: string | undefined;

    for (const s of settled) {
      if (s.status === "rejected") {
        firstError = firstError ?? String(s.reason?.message ?? s.reason);
        continue;
      }
      for (const post of s.value) {
        if (post.data.over_18) continue; // skip NSFW false-positives
        const m = toScannedMention(post);
        if (!m.sourceUrl) continue;
        if (seen.has(m.sourceUrl)) continue;
        seen.set(m.sourceUrl, m);
      }
    }

    const mentions = Array.from(seen.values());
    const ok = mentions.length > 0 || !firstError;
    return {
      source: "reddit",
      ok,
      found: mentions.length,
      mentions,
      error: firstError,
    };
  } catch (err) {
    return {
      source: "reddit",
      ok: false,
      found: 0,
      mentions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
