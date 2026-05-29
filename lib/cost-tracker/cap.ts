import "server-only";

import { prisma } from "@/lib/db";
import { logUsage, microCentsToUsd } from "./log";

// ---------------------------------------------------------------------------
// Spend cap enforcement.
//
// Reads month-to-date spend across ALL providers and short-circuits
// the daily-signals cron when the monthly cap is exceeded. Per-provider
// caps come later; for now we just want a single hard ceiling so 10
// tenants × daily cron doesn't quietly burn the AWS bill.
//
// Caps are read from env so they're tunable without a deploy:
//   COST_MONTHLY_CAP_USD          — global ceiling, defaults to $200
//   COST_MONTHLY_CAP_DATAFORSEO   — optional per-provider override
//   COST_MONTHLY_CAP_TAVILY       — optional per-provider override
//   COST_MONTHLY_CAP_ANTHROPIC    — optional per-provider override
//
// withSpendCap is the canonical wrapper. Pattern:
//
//   const result = await withSpendCap({ provider: "tavily" }, async () => {
//     return await tavilyClient.search(...);
//   });
//   if (result.status === "skipped_cap") { /* fallback or surface */ }
// ---------------------------------------------------------------------------

const DEFAULT_GLOBAL_CAP_USD = 200;

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

function readEnvUsdCap(key: string, fallback: number | null): number | null {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export interface MonthToDateSpend {
  /** Total across all providers in USD. */
  totalUsd: number;
  /** Per-provider breakdown in USD. */
  perProvider: Record<string, number>;
  /** When the rollup was computed (so callers can cache for a few
   *  minutes without re-querying). */
  computedAt: Date;
}

/**
 * Sum the ApiUsage table from the first of the current UTC month to now.
 * Returns dollars (not microcents) so callers can compare directly to
 * env-configured cap values.
 */
export async function getMonthToDateSpend(): Promise<MonthToDateSpend> {
  const since = startOfMonthUtc();
  const rows = await prisma.apiUsage.groupBy({
    by: ["provider"],
    where: {
      createdAt: { gte: since },
      // Skipped-cap rows have 0 cost but we still count nothing — same
      // result. ERROR rows had real upstream attempts so they DO count
      // because they cost us the partial connection.
    },
    _sum: { costMicroCents: true },
  });
  const perProvider: Record<string, number> = {};
  let totalMc = 0;
  for (const row of rows) {
    const mc = row._sum.costMicroCents ?? 0;
    perProvider[row.provider] = microCentsToUsd(mc);
    totalMc += mc;
  }
  return {
    totalUsd: microCentsToUsd(totalMc),
    perProvider,
    computedAt: new Date(),
  };
}

export type CapDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: string;
      /** Month-to-date spend that tripped the cap (USD). */
      spentUsd: number;
      /** Configured cap (USD). */
      capUsd: number;
    };

/**
 * Decide whether the next call to a given provider is allowed under
 * current caps. Reads month-to-date spend AND any per-provider cap env.
 *
 * Pure read — never logs or mutates. Use withSpendCap() when you also
 * want to record the skipped event.
 */
export async function checkSpendCap(
  provider: string,
): Promise<CapDecision> {
  const mtd = await getMonthToDateSpend();
  const globalCap = readEnvUsdCap("COST_MONTHLY_CAP_USD", DEFAULT_GLOBAL_CAP_USD);
  if (globalCap != null && mtd.totalUsd >= globalCap) {
    return {
      allowed: false,
      reason: `Global monthly cap reached ($${mtd.totalUsd.toFixed(2)} of $${globalCap.toFixed(2)}). Bump COST_MONTHLY_CAP_USD to override.`,
      spentUsd: mtd.totalUsd,
      capUsd: globalCap,
    };
  }
  const providerCapKey = `COST_MONTHLY_CAP_${provider.toUpperCase()}`;
  const providerCap = readEnvUsdCap(providerCapKey, null);
  if (providerCap != null) {
    const providerSpend = mtd.perProvider[provider] ?? 0;
    if (providerSpend >= providerCap) {
      return {
        allowed: false,
        reason: `${provider} monthly cap reached ($${providerSpend.toFixed(2)} of $${providerCap.toFixed(2)}). Bump ${providerCapKey} to override.`,
        spentUsd: providerSpend,
        capUsd: providerCap,
      };
    }
  }
  return { allowed: true };
}

interface WithSpendCapOptions {
  provider: string;
  endpoint: string;
  orgId?: string | null;
  propertyId?: string | null;
  prospectAuditId?: string | null;
}

export type WithSpendCapResult<T> =
  | { status: "ok"; data: T }
  | {
      status: "skipped_cap";
      reason: string;
      spentUsd: number;
      capUsd: number;
    };

/**
 * Run an upstream call only if spend caps allow it. Logs a SKIPPED_CAP
 * row when the cap blocks the call so the dashboard can show "we
 * skipped 14 Tavily calls today because the monthly cap tripped."
 *
 * Caller pattern:
 *
 *   const result = await withSpendCap(
 *     { provider: "tavily", endpoint: "search", prospectAuditId: id },
 *     async () => tavilyClient.search(...)
 *   );
 *   if (result.status === "skipped_cap") return fallbackEmptyResult();
 *   const realResult = result.data;
 *
 * NOTE: this wrapper does NOT log the SUCCESS event — that's the
 * provider wrapper's job, because the wrapper knows the actual cost
 * returned by the upstream (DataForSEO returns cost per call; Tavily
 * is a flat per-call rate; Anthropic charges per token). The wrapper
 * already has logUsage in its happy path; withSpendCap only handles
 * the SKIPPED case.
 */
export async function withSpendCap<T>(
  opts: WithSpendCapOptions,
  fn: () => Promise<T>,
): Promise<WithSpendCapResult<T>> {
  const decision = await checkSpendCap(opts.provider);
  if (!decision.allowed) {
    await logUsage({
      provider: opts.provider,
      endpoint: opts.endpoint,
      status: "SKIPPED_CAP",
      costUsd: 0,
      orgId: opts.orgId ?? null,
      propertyId: opts.propertyId ?? null,
      prospectAuditId: opts.prospectAuditId ?? null,
      meta: {
        reason: decision.reason,
        spentUsd: decision.spentUsd,
        capUsd: decision.capUsd,
      },
    });
    return {
      status: "skipped_cap",
      reason: decision.reason,
      spentUsd: decision.spentUsd,
      capUsd: decision.capUsd,
    };
  }
  const data = await fn();
  return { status: "ok", data };
}
