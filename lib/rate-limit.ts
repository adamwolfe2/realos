import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let redisWarningLogged = false

function createRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    if (!redisWarningLogged) {
      console.warn('[RATE-LIMIT] Redis not configured — rate limiting disabled. Set KV_REST_API_URL and KV_REST_API_TOKEN to enable.')
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

// 30 admin read requests per userId per minute
export const adminReadLimiter = createLimiter(redis, 30, '1 m')

/** Returns true if the request should be allowed; false if rate-limited. Skips gracefully if limiter is null (env vars not set). */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ allowed: boolean; limit: number; remaining: number; reset: number }> {
  if (!limiter) {
    // In production, fail closed — deny requests when rate limiting is unavailable
    if (process.env.NODE_ENV === 'production') {
      console.error('[RATE-LIMIT] Limiter unavailable in production — denying request for safety.')
      return { allowed: false, limit: 0, remaining: 0, reset: 0 }
    }
    return { allowed: true, limit: 0, remaining: 0, reset: 0 }
  }
  const result = await limiter.limit(identifier)
  return {
    allowed: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

/** Extract the best available IP address from a request. */
export function getIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return '127.0.0.1'
}
