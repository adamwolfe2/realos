import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSeoSync } from "@/lib/integrations/seo-sync";

// GET /api/cron/seo-sync
//
// Daily cron, scheduled in vercel.json at 06:00 UTC.
//
// Iterates every tenant that has at least one SeoIntegration row and runs
// `runSeoSync` for it. Each invocation pulls yesterday's data into the
// snapshot tables. Idempotent — the underlying upserts are keyed on
// (orgId, date[, query|url]).
//
// Auth: Bearer CRON_SECRET, matching the AppFolio cron's contract.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
}
