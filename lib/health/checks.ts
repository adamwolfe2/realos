/**
 * Health check primitives. Each function returns a CheckResult with status,
 * latency, and optional details. Used by both `/api/health` and the internal
 * `/admin/system` dashboard so the two surfaces stay in sync.
 *
 * All checks must:
 *   - never throw (catch internally and report `down` with the message)
 *   - support a timeoutMs cap so a hung dependency cannot stall the response
 *   - report latency so the dashboard can flag degraded calls (>1s by default)
 */
import "server-only";
import { prisma } from "@/lib/db";

export type HealthStatus = "ok" | "degraded" | "down";

export interface CheckResult {
  status: HealthStatus;
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
}

const DEFAULT_TIMEOUT_MS = 4000;
const DEGRADED_LATENCY_MS = 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function statusFor(latencyMs: number, ok: boolean): HealthStatus {
  if (!ok) return "down";
  return latencyMs > DEGRADED_LATENCY_MS ? "degraded" : "ok";
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

export async function checkDatabase(): Promise<CheckResult> {
  const started = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DEFAULT_TIMEOUT_MS, "database");
    const latencyMs = Date.now() - started;
    return { status: statusFor(latencyMs, true), latencyMs };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - started,
      message: errMessage(err),
    };
  }
}

// Same as checkDatabase but exercises a real table. Used by `/api/health/deep`
// so an uptime monitor can prove application-level reads work, not just the
// pooler handshake.
export async function checkDatabaseDeep(): Promise<CheckResult> {
  const started = Date.now();
  try {
    const orgs = await withTimeout(
      prisma.organization.count(),
      DEFAULT_TIMEOUT_MS,
      "database-deep"
    );
    const latencyMs = Date.now() - started;
    return {
      status: statusFor(latencyMs, true),
      latencyMs,
      details: { orgCount: orgs },
    };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - started,
      message: errMessage(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const REQUIRED_ENVS = [
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "ANTHROPIC_API_KEY",
  "CRON_SECRET",
  // Used to AES-256-GCM encrypt per-tenant secrets (AppFolio creds, OAuth
  // tokens). Missing means AppFolio sync and ad-platform OAuth crash on
  // first decrypt.
  "ENCRYPTION_KEY",
] as const;

const OPTIONAL_ENVS = [
  "CURSIVE_API_KEY",
  "CURSIVE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "VERCEL_API_TOKEN",
  // Upstash Redis powers all rate limiters. If missing, every public
  // endpoint fails OPEN (no rate limit). Health surfaces the warning so
  // ops sees it without us having to fail closed at runtime.
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
] as const;

export function checkEnv(): CheckResult {
  const started = Date.now();
  const missingRequired = REQUIRED_ENVS.filter((k) => !process.env[k]);
  const missingOptional = OPTIONAL_ENVS.filter((k) => !process.env[k]);

  const status: HealthStatus =
    missingRequired.length > 0
      ? "down"
      : missingOptional.length > 0
        ? "degraded"
        : "ok";

  const message =
    missingRequired.length > 0
      ? `missing required: ${missingRequired.join(", ")}`
      : missingOptional.length > 0
        ? `missing optional: ${missingOptional.join(", ")}`
        : undefined;

  return {
    status,
    latencyMs: Date.now() - started,
    message,
    details: {
      missingRequired,
      missingOptional,
      checkedRequired: REQUIRED_ENVS.length,
      checkedOptional: OPTIONAL_ENVS.length,
    },
  };
}

// ---------------------------------------------------------------------------
// External services
// ---------------------------------------------------------------------------

// Generic reachability helper with timeout + latency tracking.
async function pingUrl(
  url: string,
  init: RequestInit,
  label: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<CheckResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    const latencyMs = Date.now() - started;
    // Any non-5xx response means the dependency is reachable. 401/403/404 are
    // treated as healthy because they prove the network path and TLS work.
    const ok = res.status < 500;
    return {
      status: statusFor(latencyMs, ok),
      latencyMs,
      message: ok ? undefined : `HTTP ${res.status}`,
      details: { httpStatus: res.status },
    };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - started,
      message: `${label}: ${errMessage(err)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkClerk(): Promise<CheckResult> {
  const headers: Record<string, string> = {};
  if (process.env.CLERK_SECRET_KEY) {
    headers["Authorization"] = `Bearer ${process.env.CLERK_SECRET_KEY}`;
  }
  return pingUrl(
    "https://api.clerk.com/v1/jwks",
    { method: "GET", headers },
    "clerk"
  );
}

export async function checkAnthropic(): Promise<CheckResult> {
  // We hit /v1/models with the API key. A 401 (no key) still proves
  // reachability; with a key we get 200. POSTing a real prompt would cost
  // tokens for every health probe, so we deliberately skip it.
  const headers: Record<string, string> = {
    "anthropic-version": "2023-06-01",
  };
  if (process.env.ANTHROPIC_API_KEY) {
    headers["x-api-key"] = process.env.ANTHROPIC_API_KEY;
  }
  return pingUrl(
    "https://api.anthropic.com/v1/models",
    { method: "GET", headers },
    "anthropic"
  );
}

export async function checkCursive(): Promise<CheckResult> {
  // AudienceLab/Cursive does not publish a documented /health endpoint. We
  // hit the API root which 404s with a JSON envelope when reachable. Any
  // non-5xx is healthy here.
  return pingUrl(
    "https://api.audiencelab.io/",
    { method: "GET" },
    "cursive"
  );
}

export async function checkStripe(): Promise<CheckResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      status: "degraded",
      latencyMs: 0,
      message: "STRIPE_SECRET_KEY not configured",
    };
  }
  return pingUrl(
    "https://api.stripe.com/v1/balance",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    },
    "stripe"
  );
}

export async function checkResend(): Promise<CheckResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return {
      status: "degraded",
      latencyMs: 0,
      message: "RESEND_API_KEY not configured",
    };
  }
  return pingUrl(
    "https://api.resend.com/domains",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    },
    "resend"
  );
}

// ---------------------------------------------------------------------------
// Cron + platform pulse
// ---------------------------------------------------------------------------

export interface CronRunSummary {
  jobName: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  status: string;
  durationMs: number | null;
  recordsProcessed: number | null;
  error: string | null;
}

// Returns the most recent CronRun row per jobName. Falls back to an empty
// list if the table does not exist yet (migration not applied).
export async function getRecentCronRuns(limit = 50): Promise<CronRunSummary[]> {
  try {
    const rows = await prisma.$queryRaw<CronRunSummary[]>`
      SELECT DISTINCT ON ("jobName")
        "jobName",
        "startedAt",
        "finishedAt",
        "status",
        "durationMs",
        "recordsProcessed",
        "error"
      FROM "CronRun"
      ORDER BY "jobName", "startedAt" DESC
      LIMIT ${limit}
    `;
    return rows;
  } catch {
    return [];
  }
}

export interface PlatformPulse {
  activeTenants: number;
  leadsLast24h: number;
  visitorsLast24h: number;
  chatbotConversationsLast24h: number;
  webhookEventsLast24h: number;
}

export async function getPlatformPulse(): Promise<PlatformPulse> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [
    activeTenants,
    leadsLast24h,
    visitorsLast24h,
    chatbotConversationsLast24h,
    webhookEventsLast24h,
  ] = await Promise.all([
    prisma.organization
      .count({
        where: {
          orgType: "CLIENT",
          status: { in: ["LAUNCHED", "ACTIVE"] },
        },
      })
      .catch(() => 0),
    prisma.lead.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.visitor
      .count({ where: { createdAt: { gte: since } } })
      .catch(() => 0),
    prisma.chatbotConversation
      .count({ where: { createdAt: { gte: since } } })
      .catch(() => 0),
    prisma.webhookEvent
      .count({ where: { receivedAt: { gte: since } } })
      .catch(() => 0),
  ]);

  return {
    activeTenants,
    leadsLast24h,
    visitorsLast24h,
    chatbotConversationsLast24h,
    webhookEventsLast24h,
  };
}

// ---------------------------------------------------------------------------
// Aggregator
// ---------------------------------------------------------------------------

export interface SystemHealth {
  status: HealthStatus;
  timestamp: string;
  version: string;
  totalLatencyMs: number;
  checks: {
    database: CheckResult;
    env: CheckResult;
    clerk: CheckResult;
    anthropic: CheckResult;
    cursive: CheckResult;
    stripe: CheckResult;
    resend: CheckResult;
  };
}

export interface SystemHealthDeep extends SystemHealth {
  pulse: PlatformPulse;
  recentCrons: CronRunSummary[];
}

function rollUp(checks: Record<string, CheckResult>): HealthStatus {
  const values = Object.values(checks);
  if (values.some((c) => c.status === "down")) return "down";
  if (values.some((c) => c.status === "degraded")) return "degraded";
  return "ok";
}

export async function runSystemHealth(): Promise<SystemHealth> {
  const started = Date.now();
  const [database, clerk, anthropic, cursive, stripe, resend] =
    await Promise.all([
      checkDatabase(),
      checkClerk(),
      checkAnthropic(),
      checkCursive(),
      checkStripe(),
      checkResend(),
    ]);
  const env = checkEnv();
  const checks = { database, env, clerk, anthropic, cursive, stripe, resend };
  return {
    status: rollUp(checks),
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    totalLatencyMs: Date.now() - started,
    checks,
  };
}

export async function runSystemHealthDeep(): Promise<SystemHealthDeep> {
  const started = Date.now();
  const [database, clerk, anthropic, cursive, stripe, resend, pulse, recentCrons] =
    await Promise.all([
      checkDatabaseDeep(),
      checkClerk(),
      checkAnthropic(),
      checkCursive(),
      checkStripe(),
      checkResend(),
      getPlatformPulse(),
      getRecentCronRuns(),
    ]);
  const env = checkEnv();
  const checks = { database, env, clerk, anthropic, cursive, stripe, resend };
  return {
    status: rollUp(checks),
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    totalLatencyMs: Date.now() - started,
    checks,
    pulse,
    recentCrons,
  };
}
