import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runAdsSyncForAccount } from "@/lib/integrations/ads-sync";
import { recordCronRun } from "@/lib/health/cron-run";

// GET /api/cron/ads-sync
//
// Daily cron (07:00 UTC). Iterates every AdAccount with autoSyncEnabled=true
// and credentials present, then pulls yesterday's metrics. Idempotent thanks
// to the (campaignId, date) unique on AdMetricDaily.
//
// Auth: Bearer CRON_SECRET (matches the AppFolio cron pattern).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
