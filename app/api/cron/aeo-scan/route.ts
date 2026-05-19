import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { runAeoScan } from "@/lib/aeo/orchestrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// AEO scans can run up to ~45s per org × N orgs; bump maxDuration to the
// Pro plan ceiling. Properties / engine throttling keeps individual orgs
// well under this.
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// GET /api/cron/aeo-scan
//
// Fires every Monday at 02:00 UTC (vercel.json), just before the existing
// weekly digest at 09:00 UTC. Iterates every org that has the SEO module
// enabled and runs a scan: 3 prompts × N marketable properties × M enabled
// engines. Writes results to AeoCitationCheck and a CronRun row.
//
// Auth: Bearer CRON_SECRET.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("aeo-scan", async () => {
    const orgs = await prisma.organization.findMany({
      where: { moduleSEO: true },
      select: { id: true, name: true },
    });

    const summary: Array<{
      orgId: string;
      orgName: string;
      rowsWritten?: number;
      propertiesScanned?: number;
      skipped?: number;
      errors?: number;
      enginesUsed?: string[];
      error?: string;
    }> = [];

    let totalRows = 0;

    for (const org of orgs) {
      try {
        const result = await runAeoScan({ orgId: org.id });
        totalRows += result.rowsWritten;
        summary.push({
          orgId: org.id,
          orgName: org.name,
          rowsWritten: result.rowsWritten,
          propertiesScanned: result.propertiesScanned,
          skipped: result.skipped,
          errors: result.errors,
          enginesUsed: result.enginesUsed,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[cron/aeo-scan] org ${org.id} (${org.name}) failed: ${message}`,
        );
        summary.push({
          orgId: org.id,
          orgName: org.name,
          error: message,
        });
      }
    }

    return {
      result: NextResponse.json({ ok: true, totalRows, orgs: summary }),
      recordsProcessed: totalRows,
    };
  });
}
