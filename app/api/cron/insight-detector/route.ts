import { NextRequest, NextResponse } from "next/server";
import { recordCronRun } from "@/lib/health/cron-run";
import { runInsightDetectorsForAll } from "@/lib/insights/run";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// GET /api/cron/insight-detector
//
// Runs every 30 minutes. Iterates every active client and runs the full
// detector registry. Upserts are dedupe-keyed so re-firing is safe and
// cheap. Auth: Bearer CRON_SECRET.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("insight-detector", async () => {
    const summaries = await runInsightDetectorsForAll();

    const recordsProcessed = summaries.reduce(
      (a, s) => a + s.totalInserted + s.totalUpdated,
      0,
    );

    return {
      result: NextResponse.json({
        ok: true,
        orgs: summaries.length,
        totals: summaries.reduce(
          (acc, s) => ({
            detected: acc.detected + s.totalDetected,
            inserted: acc.inserted + s.totalInserted,
            updated: acc.updated + s.totalUpdated,
            resolved: acc.resolved + s.totalResolved,
          }),
          { detected: 0, inserted: 0, updated: 0, resolved: 0 },
        ),
        detail: summaries.map((s) => ({
          orgId: s.orgId,
          detected: s.totalDetected,
          inserted: s.totalInserted,
          updated: s.totalUpdated,
          resolved: s.totalResolved,
          errors: s.detectorResults.filter((r) => r.error).map((r) => ({
            detector: r.detector,
            error: r.error,
          })),
        })),
      }),
      recordsProcessed,
    };
  });
}
