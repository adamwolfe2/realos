import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { runSourceReplenish } from "@/lib/marketplace/cursive-sync";

// ---------------------------------------------------------------------------
// POST /api/admin/marketplace/sync-now
//
// Admin-only manual trigger of the marketplace replenishment. Useful for:
//   - Testing a newly-configured MarketplaceSyncSource without waiting
//     for the weekly cron.
//   - Force-refreshing after a Cursive segment update.
//
// Body: { sourceId?: string }
//   - If sourceId is provided, runs only that source.
//   - If omitted, runs every enabled source (same as the cron).
// ---------------------------------------------------------------------------

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    await requireAgency();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { sourceId?: string };
  const targetId = body.sourceId;

  const sources = await prisma.marketplaceSyncSource.findMany({
    where: targetId ? { id: targetId } : { enabled: true },
  });

  if (sources.length === 0) {
    return NextResponse.json(
      { error: "no_sources", message: "No MarketplaceSyncSource rows match." },
      { status: 400 },
    );
  }

  const summaries: unknown[] = [];
  for (const source of sources) {
    try {
      const summary = await runSourceReplenish(source);
      summaries.push({
        sourceId: source.id,
        sourceName: source.name,
        ...summary,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summaries.push({
        sourceId: source.id,
        sourceName: source.name,
        status: "FAILED",
        errorMessage: message,
      });
    }
  }

  return NextResponse.json({ ok: true, sources: sources.length, summaries });
}
