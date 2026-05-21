import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { runFactTableAggregation } from "@/lib/seo/aggregate-fact-table";

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
    return {
      result: NextResponse.json({
        ok: true,
        ...stats,
        errors: stats.errors.slice(0, 20),
      }),
      recordsProcessed: stats.rowsWritten,
    };
  });
}
