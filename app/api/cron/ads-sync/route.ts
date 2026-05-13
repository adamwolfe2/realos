import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runAdsSyncForAccount } from "@/lib/integrations/ads-sync";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// GET /api/cron/ads-sync
//
// Daily cron (07:00 UTC). Iterates every AdAccount with autoSyncEnabled=true
// and credentials present, then pulls yesterday's metrics. Idempotent thanks
// to the (campaignId, date) unique on AdMetricDaily.
//
// Auth: Bearer CRON_SECRET (matches the AppFolio cron pattern).
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("ads-sync", async () => {
    const accounts = await prisma.adAccount.findMany({
      where: {
        autoSyncEnabled: true,
        credentialsEncrypted: { not: null },
      },
      select: { id: true, orgId: true, platform: true },
    });

    const results: Array<{
      adAccountId: string;
      orgId: string;
      platform: string;
      ok: boolean;
      campaigns?: number;
      metrics?: number;
      error?: string;
    }> = [];

    for (const account of accounts) {
      try {
        const r = await runAdsSyncForAccount(account.id, { fullBackfill: false });
        results.push({
          adAccountId: account.id,
          orgId: account.orgId,
          platform: account.platform,
          ok: r.ok,
          campaigns: r.stats.campaignsUpserted,
          metrics: r.stats.metricRowsUpserted,
          error: r.error,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.warn(
          `[cron/ads-sync] account=${account.id} platform=${account.platform} failed: ${message}`
        );
        results.push({
          adAccountId: account.id,
          orgId: account.orgId,
          platform: account.platform,
          ok: false,
          error: message,
        });
      }
    }

    // On-data-arrival insight pass per affected org. Only fires for orgs
    // where at least one account synced successfully so we don't spam
    // detectors when the run was a no-op. De-duped via Set.
    const successfulOrgIds = new Set(
      results.filter((r) => r.ok).map((r) => r.orgId),
    );
    if (successfulOrgIds.size > 0) {
      try {
        const { triggerInsightsForOrg } = await import(
          "@/lib/insights/triggers"
        );
        for (const orgId of successfulOrgIds) {
          triggerInsightsForOrg(orgId, "ads_sync_complete");
        }
      } catch (err) {
        console.warn("[cron/ads-sync] failed to trigger insights", err);
      }
    }

    return {
      result: NextResponse.json({
        ok: true,
        processed: results.length,
        accounts: accounts.length,
        results,
      }),
      recordsProcessed: results.filter((r) => r.ok).length,
    };
  });
}
