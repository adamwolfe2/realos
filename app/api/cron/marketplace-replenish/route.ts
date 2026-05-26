import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { runSourceReplenish } from "@/lib/marketplace/cursive-sync";

// ---------------------------------------------------------------------------
// GET /api/cron/marketplace-replenish
//
// Weekly cron (Mondays 06:00 UTC, see vercel.json). Iterates every enabled
// MarketplaceSyncSource, pulls its Cursive segment, enriches every member,
// upserts MarketplaceLead rows, and reaps stale rows.
//
// Auth: Bearer CRON_SECRET (verifyCronAuth).
//
// Behaviour:
//   - Sources are processed serially. Each source is independent — a
//     failure on one source doesn't block the next.
//   - The cron returns a summary array, one entry per source.
//   - recordCronRun() captures duration + success state for the
//     /admin/system health dashboard.
// ---------------------------------------------------------------------------

export const maxDuration = 300; // 5 min — Vercel Pro cap; replenish can be long

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun<NextResponse>("marketplace-replenish", async () => {
    const sources = await prisma.marketplaceSyncSource.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
    });

    if (sources.length === 0) {
      return {
        result: NextResponse.json({
          ok: true,
          sources: 0,
          message:
            "No enabled MarketplaceSyncSource rows. Configure at least one to populate the marketplace.",
        }),
        recordsProcessed: 0,
      };
    }

    const summaries: unknown[] = [];
    let totalUpserted = 0;

    for (const source of sources) {
      try {
        const summary = await runSourceReplenish(source);
        totalUpserted += summary.upsertedCount;
        summaries.push({
          sourceId: source.id,
          sourceName: source.name,
          ...summary,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          "marketplace replenish — source failed",
          source.id,
          message,
        );
        summaries.push({
          sourceId: source.id,
          sourceName: source.name,
          status: "FAILED",
          errorMessage: message,
        });
      }
    }

    return {
      result: NextResponse.json({
        ok: true,
        sources: sources.length,
        summaries,
      }),
      recordsProcessed: totalUpserted,
    };
  });
}
