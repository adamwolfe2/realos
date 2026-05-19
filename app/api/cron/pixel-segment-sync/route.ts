import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordCronRun } from "@/lib/health/cron-run";
import { runCursiveSegmentSync } from "@/lib/actions/admin-cursive";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300;

// GET /api/cron/pixel-segment-sync
//
// Runs every 5 minutes. For every CursiveIntegration with a bound
// cursiveSegmentId, pulls the latest identified visitors from
// AudienceLab's segments REST API and reconciles them into the local
// Visitor table. Idempotent — re-runs are safe and dedupe via the
// (orgId, cursiveVisitorId) unique index.
//
// Pulled in from the prior 30-min schedule. AL webhooks are the primary
// path; the segment pull exists to self-heal when AL's webhook config
// drifts or our receiver had a brief outage. A 30-min worst-case meant
// operators kept hitting the per-page 'Sync now' button between ticks
// — at 5 min the stale-on-load trigger (see lib/sync/freshness.ts —
// cursive_pixel staleAfterMs is also 2 min) handles the gap and the
// integration card never lies about freshness for more than a few
// minutes.
//
// Why a cron when we have a webhook? Three reasons:
//   1. Self-heal when AudienceLab's webhook config drifts (operator
//      changed it, AL deployed a regression, our endpoint had a brief
//      outage that lost events). Pull catches up automatically.
//   2. Pre-pixel-install backfill. If the operator just provisioned the
//      segment, we don't have to wait for the next visitor to land —
//      the cron pulls the existing membership.
//   3. Predictable freshness ceiling. Worst-case staleness is 5 min
//      regardless of webhook health.
//
// Regression-tested in __tests__/cursive-module.test.ts.
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
