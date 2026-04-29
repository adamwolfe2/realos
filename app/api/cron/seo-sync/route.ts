import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSeoSync } from "@/lib/integrations/seo-sync";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

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
