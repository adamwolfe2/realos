import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSeoSync } from "@/lib/integrations/seo-sync";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// GET /api/cron/seo-sync
//
// 30-minute cron, scheduled in vercel.json. Pulled down from every-6h
// because GA4 publishes intraday data that gets revised throughout the
// day — a 6h cadence meant the portal showed yesterday's numbers at
// 11am, then jumped to "today" only at the 12pm tick. 30 min keeps the
// portal close to live without exploding GA4 / GSC API quota.
//
// Iterates every tenant that has at least one SeoIntegration row and runs
// `runSeoSync` for it. Each invocation pulls a 2-day rolling window
// (today + yesterday UTC) into the snapshot tables. Idempotent — the
// underlying upserts are keyed on (orgId, date[, query|url]).
//
// On-demand companion: POST /api/tenant/seo/sync runs the same worker
// scoped to a single org, rate-limited 1/min per org via Upstash so
// the stale-on-load trigger on /portal/seo can fire safely.
//
// Auth: Bearer CRON_SECRET, matching the AppFolio cron's contract.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("seo-sync", async () => {
    // Find every distinct orgId with at least one SEO integration.
    const orgs = await prisma.seoIntegration.findMany({
      distinct: ["orgId"],
      select: { orgId: true },
    });

    const results: Array<{
      orgId: string;
      ok: boolean;
      stats?: unknown;
      error?: string;
    }> = [];

    for (const { orgId } of orgs) {
      try {
        const r = await runSeoSync(orgId);
        results.push({
          orgId,
          ok: r.ok,
          stats: r.stats,
          error: r.error,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ orgId, ok: false, error: message });
      }
    }

    // On-data-arrival insight pass — fire detectors for every org whose
    // SEO sync just landed fresh GSC / GA4 metrics. Background, non-
    // blocking; failures are swallowed inside the trigger.
    const successfulOrgIds = new Set(
      results.filter((r) => r.ok).map((r) => r.orgId),
    );
    if (successfulOrgIds.size > 0) {
      try {
        const { triggerInsightsForOrg } = await import(
          "@/lib/insights/triggers"
        );
        for (const orgId of successfulOrgIds) {
          triggerInsightsForOrg(orgId, "seo_sync_complete");
        }
      } catch (err) {
        console.warn("[cron/seo-sync] failed to trigger insights", err);
      }
    }

    return {
      result: NextResponse.json({
        ok: true,
        processed: results.length,
        results,
      }),
      recordsProcessed: results.filter((r) => r.ok).length,
    };
  });
}
