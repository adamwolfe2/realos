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

// 3 reputation scans per userId per hour. On-demand and relatively expensive
// (external API fan-out + Claude classification) so we cap per-user pressure.
// Org-level daily cap (20/day) is enforced in the route handler via a
// Prisma count, not here.
export const reputationScanLimiter = createLimiter(redis, 3, '1 h')

// 30 admin read requests per userId per minute
export const adminReadLimiter = createLimiter(redis, 30, '1 m')

// 120 pixel/JS asset requests per IP per minute (high-volume CDN-cached asset)
export const pixelAssetLimiter = createLimiter(redis, 120, '1 m')

// 30 chatbot config lookups per IP per minute (widget init on page load)
export const chatbotConfigLimiter = createLimiter(redis, 30, '1 m')

// 1000 webhook calls per IP per minute — primary protection is sig verification;
// this catches misconfigured senders or port-scan probes.
export const webhookLimiter = createLimiter(redis, 1000, '1 m')

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
  identifier: string
): Promise<{ allowed: boolean; limit: number; remaining: number; reset: number }> {
  if (!limiter) {
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
