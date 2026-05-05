import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordCronRun } from "@/lib/health/cron-run";
import { runCursiveSegmentSync } from "@/lib/actions/admin-cursive";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300;

// GET /api/cron/pixel-segment-sync
//
// Runs every 30 minutes. For every CursiveIntegration with a bound
// cursiveSegmentId, pulls the latest identified visitors from
// AudienceLab's segments REST API and reconciles them into the local
// Visitor table. Idempotent — re-runs are safe and dedupe via the
// (orgId, cursiveVisitorId) unique index.
//
// Why a cron when we have a webhook? Three reasons:
//   1. Self-heal when AudienceLab's webhook config drifts (operator
//      changed it, AL deployed a regression, our endpoint had a brief
//      outage that lost events). Pull catches up automatically.
//   2. Pre-pixel-install backfill. If the operator just provisioned the
//      segment, we don't have to wait for the next visitor to land —
//      the cron pulls the existing membership.
//   3. Predictable freshness ceiling. Worst-case staleness is 30 min
//      regardless of webhook health.
//
// Auth: Bearer CRON_SECRET.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("pixel-segment-sync", async () => {
    const integrations = await prisma.cursiveIntegration.findMany({
      where: { cursiveSegmentId: { not: null } },
      select: { orgId: true },
    });

    let synced = 0;
    let totalPulled = 0;
    let totalCreated = 0;
    const errors: { orgId: string; error: string }[] = [];

    for (const i of integrations) {
      try {
        const r = await runCursiveSegmentSync(i.orgId);
        if (r.ok) {
          synced += 1;
          totalPulled += r.pulled;
          totalCreated += r.created;
        } else {
          errors.push({ orgId: i.orgId, error: r.error });
        }
      } catch (err) {
        errors.push({
          orgId: i.orgId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      result: NextResponse.json({
        ok: true,
        integrations: integrations.length,
        synced,
        pulled: totalPulled,
        created: totalCreated,
        errors,
      }),
      recordsProcessed: totalCreated,
    };
  });
}
