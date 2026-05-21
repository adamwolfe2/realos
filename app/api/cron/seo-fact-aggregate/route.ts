import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { runFactTableAggregation } from "@/lib/seo/aggregate-fact-table";
import { writeScoreSnapshot } from "@/lib/seo/score-snapshot";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// GET /api/cron/seo-fact-aggregate
//
// Daily 05:00 UTC, after DataforSEO sync (04:00) + competitor scan
// (03:00) so the source rows already exist. Runs runFactTableAggregation
// over yesterday's data and writes QueryLandingDaily upserts.
//
// Idempotent — re-running is safe (upsert-by-key).
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authResponse = verifyCronAuth(req);
  if (authResponse) return authResponse;

  return recordCronRun<NextResponse>("seo-fact-aggregate", async () => {
    const stats = await runFactTableAggregation();

    // Weekly score snapshot — keep this cheap by writing once per Monday.
    // The upsert key (orgId, propertyId, weekOf=Mon00:00UTC) guards
    // against re-running on the same day.
    let snapshotsWritten = 0;
    const properties = await prisma.property.findMany({
      where: { launchStatus: { in: ["LIVE", "ONBOARDING"] } },
      select: { id: true, orgId: true },
      take: 500,
    });
    for (const p of properties) {
      try {
        await writeScoreSnapshot({ orgId: p.orgId, propertyId: p.id });
        snapshotsWritten += 1;
      } catch {
        // Best-effort. Aggregation success matters more than every
        // snapshot landing.
      }
    }

    return {
      result: NextResponse.json({
        ok: true,
        ...stats,
        snapshotsWritten,
        errors: stats.errors.slice(0, 20),
      }),
      recordsProcessed: stats.rowsWritten + snapshotsWritten,
    };
  });
}
