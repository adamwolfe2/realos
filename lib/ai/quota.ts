import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Per-org daily AI call quota — a BACKSTOP against a runaway Anthropic bill
// from a high-traffic tenant or a bad actor signing up on the free Foundation
// tier (which includes the public chatbot).
//
// This is intentionally NOT a paywall. The default cap (1000 calls per org
// per day) is set far above legitimate chatbot volume so this never trips
// for a real customer — the per-IP `publicApiLimiter` (60/min from
// lib/rate-limit.ts) is the real first line of defense. This counter exists
// purely so a single org can't quietly accumulate a four-figure Anthropic
// bill before anyone notices.
//
// Fail-mode policy: FAIL OPEN. Upstash being unreachable for 30s shouldn't
// silence every tenant chatbot at once. We log a warning and let the request
// through. The per-IP limiter already gates the spammy case.
// ---------------------------------------------------------------------------

const DEFAULT_QUOTA = 1000;
const TTL_SECONDS = 60 * 60 * 36; // 36h — covers any timezone alignment
const SOFT_WARN_THRESHOLD = 0.8;

let redisInstance: Redis | null | undefined;
let redisWarnedOnce = false;

function getRedis(): Redis | null {
  if (redisInstance !== undefined) return redisInstance;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisInstance = null;
    return null;
  }
  redisInstance = new Redis({ url, token });
  return redisInstance;
}

function getQuota(): number {
  const raw = process.env.AI_DAILY_QUOTA_PER_ORG;
  if (!raw) return DEFAULT_QUOTA;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_QUOTA;
  return parsed;
}

function todayUtc(): string {
  // YYYY-MM-DD in UTC. Aligning to UTC keeps the key deterministic across
  // Vercel regions; the 36h TTL absorbs any operator timezone confusion.
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function quotaKey(orgId: string): string {
  return `ai-quota:${orgId}:${todayUtc()}`;
}

export type AiQuotaResult = {
  allowed: boolean;
  count: number;
  limit: number;
  // Reason populated only when allowed=false; useful for response payloads
  // and log line correlation.
  reason?: "quota_exceeded" | "redis_unavailable_fail_open";
};

/**
 * Increment-and-check the per-org daily AI call counter. Call this once at
 * the top of any route that fans out to Anthropic/OpenAI on behalf of an
 * org; it INCR's the counter, sets a 36h TTL on the first hit, and returns
 * allowed=false once the org has used `AI_DAILY_QUOTA_PER_ORG` calls today.
 *
 * Fails OPEN on any Redis error (logged warning, request proceeds) — this is
 * deliberately a soft backstop, not a hard gate.
 */
export async function checkAiQuota(orgId: string): Promise<AiQuotaResult> {
  const limit = getQuota();
  const redis = getRedis();
  if (!redis) {
    if (!redisWarnedOnce) {
      console.warn(
        "[ai-quota] Upstash not configured — per-org AI quota disabled (fail-open). Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to enable."
      );
      redisWarnedOnce = true;
    }
    return {
      allowed: true,
      count: 0,
      limit,
      reason: "redis_unavailable_fail_open",
    };
  }

  const key = quotaKey(orgId);
  let count: number;
  try {
    count = await redis.incr(key);
    // EXPIRE is idempotent. We could gate on `count === 1` to save a round
    // trip but doing it every call is harmless and bullet-proofs against a
    // racy first-incr where two requests both see count=1 and one skips
    // the TTL set.
    await redis.expire(key, TTL_SECONDS);
  } catch (err) {
    // Fail open. A Redis blip must not break a customer-facing chatbot.
    console.warn(
      `[ai-quota] Upstash error for org=${orgId} — failing open:`,
      err
    );
    return {
      allowed: true,
      count: 0,
      limit,
      reason: "redis_unavailable_fail_open",
    };
  }

  if (count > limit) {
    // Loud log so Sentry's console.error transport picks it up. Includes
    // orgId so on-call can match this to a tenant in /admin.
    console.error(
      `[ai-quota] EXCEEDED org=${orgId} count=${count} limit=${limit} date=${todayUtc()} — request blocked. If this is a legitimate tenant, raise AI_DAILY_QUOTA_PER_ORG.`
    );
    return { allowed: false, count, limit, reason: "quota_exceeded" };
  }

  // 80% soft-warning. Single log per crossing isn't possible without a
  // separate Redis flag, so we log every call past the threshold — the
  // volume is bounded (200 logs/day per org in the default config) and
  // it makes the warning easy to graph.
  if (count >= Math.floor(limit * SOFT_WARN_THRESHOLD)) {
    console.warn(
      `[ai-quota] SOFT_WARN org=${orgId} count=${count} limit=${limit} (>=80%) date=${todayUtc()}`
    );
  }

  return { allowed: true, count, limit };
}

// Test-only export so unit tests can reset the memoized Redis instance + the
// one-shot warning flag between cases. Marked with underscore so it's clear
// this is not part of the public API.
export function __resetForTest(): void {
  redisInstance = undefined;
  redisWarnedOnce = false;
}
