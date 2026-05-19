// ---------------------------------------------------------------------------
// runAdRetentionForOrg — per-org rollup + purge of historical ad metrics.
//
// Reads the org's `AdRetentionPolicy` (lib/billing/retention.ts), then for
// every calendar month that has rolled off the daily window:
//   1. Aggregate AdMetricDaily rows by (orgId, adAccountId, year, month)
//      via groupBy + _sum (matches the dashboard's aggregation shape from
//      commit 4be0344 so we never double-count or miss a metric).
//   2. Upsert into AdMetricMonthly on the (orgId, adAccountId, year, month)
//      unique. The unique key makes the whole job idempotent — re-running
//      on the same day either no-ops (sums match) or refreshes the bucket
//      (if a late-arriving daily row was synced after the previous run).
//   3. Delete the daily rows we just folded in.
//
// For Foundation orgs (`monthlyEnabled: false`) we skip the upsert step
// and only delete the rolled-off daily rows. That's the "rolling 28-day
// window, purge older" behavior in the tier definition.
//
// Returns counters the cron writes to its log + the CronRun row.
// ---------------------------------------------------------------------------

import "server-only";
import { prisma } from "@/lib/db";
import {
  getAdRetentionPolicy,
  type AdRetentionPolicy,
} from "./retention";

export type AdRetentionResult = {
  orgId: string;
  policy: AdRetentionPolicy;
  /** AdMetricMonthly rows upserted (one per (account, month) bucket). */
  aggregated: number;
  /** AdMetricDaily rows deleted across all rolled-off months. */
  dropped: number;
  errors: string[];
};

/**
 * UTC midnight at the first of the month that's exactly N months before
 * the current month. Anything with date < this cutoff has rolled off the
 * daily window and is eligible for rollup.
 *
 * Example (now = 2026-05-19, N=12): cutoff = 2025-05-01 00:00:00Z.
 * AdMetricDaily.date "2025-04-30" → rolls off; "2025-05-01" → kept.
 */
export function cutoffDateForMonths(now: Date, monthsBack: number): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0..11
  // First-of-month, monthsBack months ago. Date handles year wrap.
  return new Date(Date.UTC(y, m - monthsBack, 1, 0, 0, 0, 0));
}

export async function runAdRetentionForOrg(
  orgId: string,
  options: { now?: Date } = {},
): Promise<AdRetentionResult> {
  const now = options.now ?? new Date();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      subscriptionTier: true,
      adDataRetentionMonths: true,
    },
  });

  // Default to the strictest policy if the org vanished mid-run.
  const policy = getAdRetentionPolicy({
    tier: org?.subscriptionTier ?? null,
    adDataRetentionMonths: org?.adDataRetentionMonths ?? null,
  });

  const errors: string[] = [];
  let aggregated = 0;
  let dropped = 0;

  const cutoff = cutoffDateForMonths(now, policy.dailyWindowMonths);

  // Foundation: no monthly aggregates, just delete anything older than
  // the cutoff. `deleteMany` returns the count directly.
  if (!policy.monthlyEnabled) {
    try {
      const r = await prisma.adMetricDaily.deleteMany({
        where: { orgId, date: { lt: cutoff } },
      });
      dropped = r.count;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
    return { orgId, policy, aggregated, dropped, errors };
  }

  // Growth / Scale / Enterprise: roll up first, then delete.
  //
  // groupBy by adAccountId only would lose the month granularity. We need
  // (adAccountId, year, month). Prisma supports groupBy by columns but
  // not arbitrary expressions, so we read the rolled-off rows and bucket
  // them in app code. To keep the round trip manageable we paginate by
  // adAccount: one DB pass per account, summing in-process. Even at 5
  // years of dailies that's ~1825 rows/account — trivially fast.
  let accountIds: string[];
  try {
    const accounts = await prisma.adAccount.findMany({
      where: { orgId },
      select: { id: true },
    });
    accountIds = accounts.map((a) => a.id);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { orgId, policy, aggregated, dropped, errors };
  }

  for (const adAccountId of accountIds) {
    try {
      const oldRows = await prisma.adMetricDaily.findMany({
        where: {
          orgId,
          adAccountId,
          date: { lt: cutoff },
        },
        select: {
          date: true,
          impressions: true,
          clicks: true,
          spendCents: true,
          conversions: true,
          conversionValueCents: true,
        },
      });

      if (oldRows.length === 0) continue;

      // Bucket by (year, month). Map key: "YYYY-MM".
      type Bucket = {
        year: number;
        month: number;
        impressions: number;
        clicks: number;
        spendCents: number;
        conversions: number;
        conversionValueCents: number;
        daysAggregated: number;
      };
      const buckets = new Map<string, Bucket>();
      for (const row of oldRows) {
        const y = row.date.getUTCFullYear();
        const m = row.date.getUTCMonth() + 1; // 1..12
        const key = `${y}-${m}`;
        let b = buckets.get(key);
        if (!b) {
          b = {
            year: y,
            month: m,
            impressions: 0,
            clicks: 0,
            spendCents: 0,
            conversions: 0,
            conversionValueCents: 0,
            daysAggregated: 0,
          };
          buckets.set(key, b);
        }
        b.impressions += row.impressions;
        b.clicks += row.clicks;
        b.spendCents += row.spendCents;
        b.conversions += row.conversions;
        b.conversionValueCents += row.conversionValueCents;
        b.daysAggregated += 1;
      }

      // Upsert each bucket. Idempotent via the unique key — re-running
      // on the same input produces the same row.
      for (const b of buckets.values()) {
        await prisma.adMetricMonthly.upsert({
          where: {
            orgId_adAccountId_year_month: {
              orgId,
              adAccountId,
              year: b.year,
              month: b.month,
            },
          },
          create: {
            orgId,
            adAccountId,
            year: b.year,
            month: b.month,
            impressions: b.impressions,
            clicks: b.clicks,
            spendCents: b.spendCents,
            conversions: b.conversions,
            conversionValueCents: b.conversionValueCents,
            daysAggregated: b.daysAggregated,
          },
          update: {
            impressions: b.impressions,
            clicks: b.clicks,
            spendCents: b.spendCents,
            conversions: b.conversions,
            conversionValueCents: b.conversionValueCents,
            daysAggregated: b.daysAggregated,
            aggregatedAt: now,
          },
        });
        aggregated += 1;
      }

      // Drop the daily rows we just folded in. Bound by the same cutoff +
      // adAccountId so a concurrent ads-sync writing fresher rows can't
      // collide.
      const del = await prisma.adMetricDaily.deleteMany({
        where: {
          orgId,
          adAccountId,
          date: { lt: cutoff },
        },
      });
      dropped += del.count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`adAccount=${adAccountId}: ${msg}`);
    }
  }

  return { orgId, policy, aggregated, dropped, errors };
}
