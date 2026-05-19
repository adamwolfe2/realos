import { NextRequest, NextResponse } from "next/server";
import { OrgType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { runAdRetentionForOrg } from "@/lib/billing/ad-retention-job";

export const maxDuration = 300; // 5 min — Vercel Pro cap. Per-org work is bounded.

// GET /api/cron/ad-retention
//
// Daily cron (03:30 UTC). For every CLIENT org with at least one AdAccount,
// resolves the tier-based retention policy and rolls AdMetricDaily rows
// outside the daily window into AdMetricMonthly buckets, then deletes the
// daily rows. Foundation orgs skip the aggregate step (rolling 28-day
// purge only).
//
// Auth: Bearer CRON_SECRET. Matches the ads-sync cron pattern so the same
// schedule + monitoring tooling applies.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("ad-retention", async () => {
    // Limit to orgs that actually have ad data to manage. An empty
    // adAccounts join filters out marketing-only / pre-launch tenants
    // so we don't waste round trips on no-op deletes.
    const orgs = await prisma.organization.findMany({
      where: {
        orgType: OrgType.CLIENT,
        adAccounts: { some: {} },
      },
      select: { id: true },
    });

    const results: Array<{
      orgId: string;
      tier: string;
      dailyWindowMonths: number;
      aggregated: number;
      dropped: number;
      errors: string[];
    }> = [];

    for (const org of orgs) {
      try {
        const r = await runAdRetentionForOrg(org.id);
        results.push({
          orgId: r.orgId,
          tier: r.policy.tier,
          dailyWindowMonths: r.policy.dailyWindowMonths,
          aggregated: r.aggregated,
          dropped: r.dropped,
          errors: r.errors,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.warn(
          `[cron/ad-retention] org=${org.id} failed: ${message}`,
        );
        results.push({
          orgId: org.id,
          tier: "unknown",
          dailyWindowMonths: 0,
          aggregated: 0,
          dropped: 0,
          errors: [message],
        });
      }
    }

    const totalAggregated = results.reduce((a, r) => a + r.aggregated, 0);
    const totalDropped = results.reduce((a, r) => a + r.dropped, 0);

    return {
      result: NextResponse.json({
        ok: true,
        orgsProcessed: results.length,
        aggregated: totalAggregated,
        dropped: totalDropped,
        results,
      }),
      recordsProcessed: totalDropped,
    };
  });
}
