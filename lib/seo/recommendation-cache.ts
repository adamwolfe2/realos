import "server-only";

// ---------------------------------------------------------------------------
// Tiny key-value cache for SEO recommendation engine output.
//
// The engine runs 6 read-only queries against existing data per call. At
// portfolio scale (admin/insights, the operator dashboard, the property
// detail page, the property strip on /portal) the same (orgId, propertyId)
// combo gets recomputed many times per minute.
//
// 1h TTL is generous — recommendations are derived from data that the
// nightly crons refresh, so an hour of staleness is fine. Operators who
// want fresher recs hit the manual refresh button (which invalidates).
//
// Falls back to an in-process LRU when Upstash isn't configured (local
// dev, preview environments without the KV env vars). The in-process
// path means the SAME process gets cache hits; multi-instance prod
// without Upstash still works, just with lower hit rate.
// ---------------------------------------------------------------------------

import { Redis } from "@upstash/redis";
import type { SeoRecommendation } from "./agent";

const TTL_SECONDS = 60 * 60; // 1 hour
const NS = "seo:recs";

let _redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _redis = null;
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// In-process fallback LRU. ~256 entries × ~12KB max each = ~3MB ceiling.
const LRU_MAX = 256;
const lru = new Map<
  string,
  { value: SeoRecommendation[]; expiresAt: number }
>();

function lruGet(key: string): SeoRecommendation[] | null {
  const hit = lru.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    lru.delete(key);
    return null;
  }
  // Reinsert to mark most-recently-used.
  lru.delete(key);
  lru.set(key, hit);
  return hit.value;
}

function lruSet(key: string, value: SeoRecommendation[]): void {
  if (lru.size >= LRU_MAX) {
    // Evict oldest (first inserted).
    const oldest = lru.keys().next().value;
    if (oldest) lru.delete(oldest);
  }
  lru.set(key, { value, expiresAt: Date.now() + TTL_SECONDS * 1000 });
}

function keyFor(orgId: string, propertyId: string): string {
  return `${NS}:${orgId}:${propertyId}`;
}

export async function getCachedRecommendations(
  orgId: string,
  propertyId: string,
): Promise<SeoRecommendation[] | null> {
  const redis = getRedis();
  const key = keyFor(orgId, propertyId);
  if (redis) {
    try {
      const raw = await redis.get<string>(key);
      if (!raw) return null;
      return typeof raw === "string"
        ? (JSON.parse(raw) as SeoRecommendation[])
        : (raw as unknown as SeoRecommendation[]);
    } catch {
      // Redis hiccup — fall through to LRU.
    }
  }
  return lruGet(key);
}

export async function setCachedRecommendations(
  orgId: string,
  propertyId: string,
  value: SeoRecommendation[],
): Promise<void> {
  const redis = getRedis();
  const key = keyFor(orgId, propertyId);
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), { ex: TTL_SECONDS });
    } catch {
      // ignore — LRU below still primes the in-process cache
    }
  }
  lruSet(key, value);
}

export async function invalidateRecommendationsCache(
  orgId: string,
  propertyId: string,
): Promise<void> {
  const redis = getRedis();
  const key = keyFor(orgId, propertyId);
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // ignore
    }
  }
  lru.delete(key);
}
