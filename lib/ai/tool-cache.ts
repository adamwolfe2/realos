import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  if (!_redis) {
    _redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return _redis;
}

/**
 * Wrap a read-only tool function with Redis caching.
 * Falls back to uncached execution if Redis is unavailable.
 *
 * @param key   Cache key (e.g. "tool:get_platform_summary")
 * @param ttl   TTL in seconds
 * @param fn    The async function to cache
 */
export async function cachedTool<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const redis = getRedis();
  if (!redis) return fn();

  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) return cached;
    const fresh = await fn();
    await redis.set(key, fresh, { ex: ttl });
    return fresh;
  } catch {
    // Redis failure — fall through to live DB
    return fn();
  }
}

/**
 * Invalidate one or more cache keys after a write action.
 */
export async function invalidateToolCache(...keys: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    // Non-critical — stale data will expire on TTL
  }
}
