import { auditStartLimiter, checkRateLimit, getIp } from "@/lib/rate-limit";

// Thin wrapper so /api/audit/* routes can do one-line rate-limit checks
// without re-importing the limiter primitives. Mirrors how the rest of
// the codebase usually inlines `checkRateLimit(limiter, getIp(req))` but
// gives the audit pipeline a single import surface in case we later
// stack a second limiter (e.g. per-email-domain cap on captures).

export async function checkAuditStartLimit(req: Request): Promise<{
  allowed: boolean;
  retryAfterSec: number;
}> {
  const result = await checkRateLimit(auditStartLimiter, getIp(req));
  return {
    allowed: result.allowed,
    retryAfterSec: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
  };
}

export { getIp };
