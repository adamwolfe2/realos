import "server-only";

import { prisma } from "@/lib/db";
import { ApiUsageStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Cost-tracker — single entry point every provider wrapper calls.
//
// Adam 2026-05-29: "we need to be very careful with the amount of data
// we're processing so we're not incurring too much cost. I'm not sure
// where these fees are going. I can't track it all!"
//
// Design:
//   * Fire-and-forget by default. Logging a cost event should never
//     block or fail the upstream call — if Postgres hiccups, the
//     scan still ships.
//   * Cost is stored in microcents (Int) so a million rows summed via
//     SUM() don't drift on floating-point. Helpers below convert to/
//     from dollars for the API surface.
//   * Scope is optional: prospect audits log without orgId, tenant
//     calls log with orgId+propertyId. The /admin/costs dashboard
//     filters on any combination.
// ---------------------------------------------------------------------------

export type CostProvider =
  | "dataforseo"
  | "tavily"
  | "anthropic"
  | "openai"
  | "perplexity"
  | "gemini"
  | "reddit"
  | "firecrawl"
  | "resend"
  // Wildcard for one-off providers we haven't formalized yet. The
  // /admin/costs UI groups unknown providers under "other."
  | (string & {});

export interface LogUsageInput {
  provider: CostProvider;
  endpoint: string;
  status?: ApiUsageStatus | "SUCCESS" | "ERROR" | "SKIPPED_CAP";
  /** Cost in USD. We multiply by 100,000 internally to get microcents.
   *  Pass 0 (default) for free APIs we just want to count (Reddit).
   *  Use centsToMicroCents() if you have cents directly. */
  costUsd?: number;
  orgId?: string | null;
  propertyId?: string | null;
  prospectAuditId?: string | null;
  /** Round-trip latency in ms — surfaced on /admin/costs SLO panel. */
  durationMs?: number | null;
  /** Per-provider extras (HTTP status, task code, token counts, model
   *  variant, etc). Free JSON, no schema churn. */
  meta?: Record<string, unknown> | null;
}

// Conversion helpers — single source of truth so no caller hand-rolls
// the math. Keeps "microcents" out of every wrapper file.
const MICRO_CENTS_PER_USD = 100_000;

export function usdToMicroCents(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) return 0;
  // Round at the microcent boundary to avoid floating-point dust
  // (e.g. 0.01 * 100000 = 999.99... in some JS engines).
  return Math.round(usd * MICRO_CENTS_PER_USD);
}

export function microCentsToUsd(microCents: number): number {
  return microCents / MICRO_CENTS_PER_USD;
}

export function microCentsToCents(microCents: number): number {
  return microCents / 1000;
}

/**
 * Fire-and-forget cost logger. Awaiting it is fine — the write is fast
 * — but never throws, so callers can swap `.catch()` patterns out.
 */
export async function logUsage(input: LogUsageInput): Promise<void> {
  try {
    const status =
      typeof input.status === "string"
        ? (input.status as ApiUsageStatus)
        : (input.status ?? ApiUsageStatus.SUCCESS);
    await prisma.apiUsage.create({
      data: {
        provider: input.provider,
        endpoint: input.endpoint.slice(0, 200),
        status,
        costMicroCents: usdToMicroCents(input.costUsd ?? 0),
        orgId: input.orgId ?? null,
        propertyId: input.propertyId ?? null,
        prospectAuditId: input.prospectAuditId ?? null,
        durationMs: input.durationMs ?? null,
        meta: (input.meta ?? null) as never,
      },
    });
  } catch (err) {
    // Swallow — never let cost logging take down the upstream call.
    // Surface to stderr so a CW alarm can pick it up if the table
    // genuinely breaks.
    console.error(
      "[cost-tracker] log failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ---------------------------------------------------------------------------
// withTiming — convenience wrapper that times a promise and forwards
// the duration to logUsage. Saves every provider from hand-rolling
// `const t = Date.now(); ... ; logUsage({ durationMs: Date.now() - t })`.
// ---------------------------------------------------------------------------
export async function withTiming<T>(
  fn: () => Promise<T>,
  log: (durationMs: number) => Promise<void> | void,
): Promise<T> {
  const start = Date.now();
  try {
    const out = await fn();
    await log(Date.now() - start);
    return out;
  } catch (err) {
    await log(Date.now() - start);
    throw err;
  }
}
