import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let redisWarningLogged = false

function createRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    if (!redisWarningLogged) {
      console.error('RATE_LIMIT_DISABLED: KV_REST_API_URL not configured — rate limiting disabled. Set KV_REST_API_URL and KV_REST_API_TOKEN to enable.')
      redisWarningLogged = true
    }
    return null
  }
  return new Redis({ url, token })
}

function createLimiter(
  redis: Redis | null,
  requests: number,
  window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`
): Ratelimit | null {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: false,
  })
}

const redis = createRedis()

// 10 checkout attempts per IP per 10 minutes
export const checkoutLimiter = createLimiter(redis, 10, '10 m')

// 5 public signups per IP per hour
export const publicSignupLimiter = createLimiter(redis, 5, '1 h')

// 3 drop notify blasts per userId per minute
export const notifyLimiter = createLimiter(redis, 3, '1 m')

// 10 AI calls per userId per hour
export const aiCallLimiter = createLimiter(redis, 10, '1 h')

// 3 CSV imports per userId per minute
export const csvImportLimiter = createLimiter(redis, 3, '1 m')

// 60 public API read requests per IP per minute (generous, read-only endpoints)
export const publicApiLimiter = createLimiter(redis, 60, '1 m')

// 1 SEO (GA4/GSC) on-demand sync per org per minute. Debounces the
// stale-on-load trigger + the manual "Run sync" button so an operator
// clicking rapidly or two tabs racing don't fan out into N concurrent
// GA4/GSC report runs. The cron still runs every 30 min regardless.
export const seoSyncLimiter = createLimiter(redis, 1, '1 m')

// 10 public alert/notification signups per IP per hour
export const publicAlertLimiter = createLimiter(redis, 10, '1 h')

// 20 public search requests per IP per minute
export const publicSearchLimiter = createLimiter(redis, 20, '1 m')

// 60 client read requests per userId per minute
export const clientReadLimiter = createLimiter(redis, 60, '1 m')

// 20 client write requests per userId per minute
export const clientWriteLimiter = createLimiter(redis, 20, '1 m')

// 5 enrich/scrape requests per userId per minute
export const enrichLimiter = createLimiter(redis, 5, '1 m')

// 30 Zillow report generations per org per minute. Bumped from 10/min
// after operators on real demos hit the cap clicking through multiple
// comps in a row. Still tight enough that Zillow's bot wall stays away
// (a single org can't push more than 30 outbound fetches/min) but lets
// a power user evaluate 10+ listings during a deal review. The route
// passes a softFallback so a misconfigured Vercel deploy missing Upstash
// env vars degrades to in-memory limiting instead of 100% blocking.
export const zillowReportLimiter = createLimiter(redis, 30, '1 m')

// 3 reputation scans per userId per hour. On-demand and relatively expensive
// (external API fan-out + Claude classification) so we cap per-user pressure.
// Org-level daily cap (20/day) is enforced in the route handler via a
// Prisma count, not here.
export const reputationScanLimiter = createLimiter(redis, 3, '1 h')

// 30 admin read requests per userId per minute
export const adminReadLimiter = createLimiter(redis, 30, '1 m')

// 120 pixel/JS asset requests per IP per minute (high-volume CDN-cached asset)
export const pixelAssetLimiter = createLimiter(redis, 120, '1 m')

// 600 chatbot config lookups per IP per minute. The widget on every
// tenant site fires this on page load, and many real visitors share an
// IP (campus WiFi, mobile carriers, corporate NAT). 30/min was
// catastrophic: a single classroom of UC Berkeley students opening
// telegraphcommons.com would silence the chatbot for everyone behind
// that NAT, because the embed treats any non-`enabled` JSON (including
// the rate-limit error body) as "chatbot disabled" and silently
// vanishes. The route also sets a 60s edge cache (Cache-Control:
// public, s-maxage=60) so 99% of requests don't reach this limiter or
// the DB — the high cap is just belt-and-suspenders for cache misses.
export const chatbotConfigLimiter = createLimiter(redis, 600, '1 m')

// 1000 webhook calls per IP per minute — primary protection is sig verification;
// this catches misconfigured senders or port-scan probes.
export const webhookLimiter = createLimiter(redis, 1000, '1 m')

// 30 bug report submissions per userId per hour. Cap protects Vercel Blob
// storage quota + cost: a malicious authenticated user could otherwise
// script thousands of multipart uploads (up to 5×8MB = 40MB per request).
// 30/hour is generous for legitimate use (even Norman bashing through QA
// rarely exceeds 10) and stops a runaway script flat.
export const bugReportLimiter = createLimiter(redis, 30, '1 h')

// Soft-fallback configurations for public widget endpoints. When Upstash
// isn't configured in Vercel env, these limiters degrade to single-instance
// in-memory limiting instead of 100% blocking (which silently breaks the
// chatbot/popup embeds on every tenant site). Each entry mirrors the
// Redis-backed limit so behavior is consistent across both code paths.
//
// Call sites pass these to checkRateLimit as `{ softFallback: WIDGET_FALLBACK.config }`.
// The fail-closed behavior is preserved for security-critical endpoints
// (auth, checkout, internal admin) which simply don't pass softFallback.
export const WIDGET_FALLBACK = {
  chatbotConfig: { requests: 600, windowMs: 60_000 }, // matches chatbotConfigLimiter
  publicApi: { requests: 60, windowMs: 60_000 }, // matches publicApiLimiter
  popupEvent: { requests: 60, windowMs: 60_000 }, // matches popupEventLimiter
  publicSignup: { requests: 5, windowMs: 60 * 60_000 }, // matches publicSignupLimiter
} as const;

// 60 popup-embed events per IP per minute. Protects denormalized counter
// integrity (shownCount / convertedCount on PopupCampaign) from drive-by
// inflation by a competitor scraping the popupId from a victim's site and
// hammering CONVERTED. Combined with the sessionId+type dedupe in the
// route handler, this should make poisoning impractical.
export const popupEventLimiter = createLimiter(redis, 60, '1 m')

// 1 ads historical export per org per hour. The export streams full
// AdMetricDaily + AdMetricMonthly history (up to several years) so it's
// IO-heavy enough that we'd rather throttle than serve five copies in a
// row to a tab-spamming operator. Org-scoped so multi-user workspaces
// share the budget — the rate-limited operator can ask a teammate to
// download instead.
export const adsExportLimiter = createLimiter(redis, 1, '1 h')

// 30 credential reveals per userId per minute. Pre-fix this was 10/min
// which felt safe in theory but was too tight in practice — legitimate
// operator behavior during initial vault exploration (revealing each
// credential once to verify it's right) or batch ops (rotating 15
// passwords as part of a security review) consistently tripped the
// limit. 30/min still bounds a compromised-session vault-drain to a
// detectable rate (1800/hour, vs ~200-credential typical vault, so
// the audit log surfaces anomalies before plaintext is fully exfil'd).
// The dedicated CredentialAccessLog table makes those anomalies
// trivial to dashboard ("more than 20 reveals in 1 hour by one user").
export const vaultRevealLimiter = createLimiter(redis, 30, '1 m')

/**
 * Returns true if the request should be allowed; false if rate-limited.
 *
 * Fail-mode policy:
 *  - DEVELOPMENT (NODE_ENV !== "production"): fail OPEN with a one-time
 *    console warning. Local dev rarely provisions Upstash, and we don't
 *    want every dev session to 429 on the first chatbot call.
 *  - PRODUCTION (NODE_ENV === "production"): fail CLOSED. A prod deploy
 *    missing UPSTASH_REDIS_REST_URL/_TOKEN is a misconfiguration that
 *    must not silently disable rate limiting on auth, public chatbot,
 *    intake submit, password reset, etc. Returning `allowed:false` here
 *    surfaces the broken deploy immediately (every request 429s) rather
 *    than letting attackers enumerate the moment Redis isn't there.
 *
 * To audit a misconfigured prod deploy: check Vercel logs for the
 * "rate-limit fail-closed: limiter is null" error or run `instrumentation`
 * boot-time assertion (added separately).
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
  options?: { softFallback?: { requests: number; windowMs: number } },
): Promise<{ allowed: boolean; limit: number; remaining: number; reset: number }> {
  if (!limiter) {
    // Soft fallback: low-stakes operator-facing tools (Zillow lookup,
    // CSV export, etc.) opt in by passing softFallback. When Redis is
    // missing in any env we degrade to an in-memory sliding-window
    // limiter rather than 100% blocking the feature. Security-critical
    // endpoints (auth, checkout, webhooks, public lead capture) do NOT
    // pass softFallback and continue to fail closed in production.
    if (options?.softFallback) {
      const { allowed, limit, remaining, reset } = inMemoryAllow(
        identifier,
        options.softFallback.requests,
        options.softFallback.windowMs,
      );
      if (!allowed && process.env.NODE_ENV === "production") {
        // One-time warn per process so we know prod is falling back.
        warnSoftFallbackOnce();
      }
      return { allowed, limit, remaining, reset };
    }
    if (process.env.NODE_ENV === "production") {
      console.error(
        `rate-limit fail-closed: limiter is null (identifier=${identifier}). Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.`,
      );
      // 60s reset gives the deploy operator a chance to fix env vars
      // and the client gets a sensible Retry-After header.
      return {
        allowed: false,
        limit: 0,
        remaining: 0,
        reset: Date.now() + 60_000,
      };
    }
    // Development: fail open.
    return { allowed: true, limit: 0, remaining: 0, reset: 0 };
  }
  const result = await limiter.limit(identifier)
  return {
    allowed: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

// ---------------------------------------------------------------------------
// In-memory sliding-window fallback. Single-instance only (per lambda /
// per Node process) — not coordinated across Vercel functions, so a
// determined operator hitting multiple concurrent regions could exceed
// the soft cap. That's an acceptable trade-off for low-stakes tools
// where the alternative is hard-blocking 100% of requests.
// ---------------------------------------------------------------------------

const inMemoryBuckets = new Map<string, number[]>();
let softFallbackWarned = false;

function inMemoryAllow(
  key: string,
  requests: number,
  windowMs: number,
): { allowed: boolean; limit: number; remaining: number; reset: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const history = inMemoryBuckets.get(key) ?? [];
  // Drop expired hits.
  const live = history.filter((t) => t > cutoff);
  if (live.length >= requests) {
    // Rate limited. Reset = when the oldest live hit expires.
    const oldest = live[0] ?? now;
    inMemoryBuckets.set(key, live);
    return {
      allowed: false,
      limit: requests,
      remaining: 0,
      reset: oldest + windowMs,
    };
  }
  live.push(now);
  inMemoryBuckets.set(key, live);
  // Opportunistic cleanup to bound memory.
  if (inMemoryBuckets.size > 5_000) {
    for (const [k, v] of inMemoryBuckets) {
      const fresh = v.filter((t) => t > cutoff);
      if (fresh.length === 0) inMemoryBuckets.delete(k);
      else inMemoryBuckets.set(k, fresh);
    }
  }
  return {
    allowed: true,
    limit: requests,
    remaining: requests - live.length,
    reset: now + windowMs,
  };
}

function warnSoftFallbackOnce(): void {
  if (softFallbackWarned) return;
  softFallbackWarned = true;
  console.warn(
    "rate-limit soft-fallback: Redis not configured — using in-memory sliding window for low-stakes endpoints. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in Vercel for coordinated limiting.",
  );
}

/**
 * Build a standardised HTTP 429 response.
 * Every rate-limit rejection in the codebase should call this so callers get
 * a consistent shape: `{ error, retryAfterSec }` + `Retry-After` header.
 */
export function rateLimited(
  msg = 'Rate limit exceeded',
  retryAfterSec = 60,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify({ error: msg, retryAfterSec }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSec),
        ...extraHeaders,
      },
    }
  )
}

/** Extract the best available IP address from a request. */
export function getIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return '127.0.0.1'
}
