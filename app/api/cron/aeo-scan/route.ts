import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { runAeoScan, runNeighborhoodScan } from "@/lib/aeo/orchestrate";
import { resolveEngineSource } from "@/lib/aeo/engines";

// Skip per-page sampling if scanned within this window. The weekly cron
// runs Mondays — 6 days keeps us re-scanning every Monday without ever
// missing a week, while letting on-demand scans inside the window
// override the cron.
const NEIGHBORHOOD_SCAN_SKIP_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;
// Cron cost guard: sample 2 claims × 2 prompts × N engines per page.
const CRON_MAX_CLAIMS_PER_PAGE = 2;
const CRON_PROMPTS_PER_CLAIM = 2;

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
    let neighborhoodPagesScanned = 0;
    let neighborhoodPagesSkipped = 0;

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

      // Sample published neighborhood pages too. We scan each page lightly
      // (2 claims × 2 prompts × M engines) so the weekly cron stays cheap
      // even if a tenant publishes 50 neighborhood pages.
      try {
        const pages = await prisma.neighborhoodPage.findMany({
          where: { orgId: org.id, status: "PUBLISHED" },
          select: { id: true },
          orderBy: { updatedAt: "desc" },
          take: 100,
        });

        const cutoff = new Date(
          Date.now() - NEIGHBORHOOD_SCAN_SKIP_WINDOW_MS,
        );

        for (const page of pages) {
          const recent = await prisma.aeoCitationCheck.count({
            where: {
              orgId: org.id,
              neighborhoodPageId: page.id,
              queryRunAt: { gte: cutoff },
            },
          });
          if (recent > 0) {
            neighborhoodPagesSkipped += 1;
            continue;
          }
          try {
            const r = await runNeighborhoodScan({
              orgId: org.id,
              pageId: page.id,
              maxClaims: CRON_MAX_CLAIMS_PER_PAGE,
              promptsPerClaim: CRON_PROMPTS_PER_CLAIM,
            });
            totalRows += r.rowsWritten;
            neighborhoodPagesScanned += 1;
          } catch (err) {
            console.error(
              `[cron/aeo-scan] neighborhood scan failed for page ${page.id}:`,
              err instanceof Error ? err.message : err,
            );
          }
        }
      } catch (err) {
        console.error(
          `[cron/aeo-scan] neighborhood iteration failed for org ${org.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    // AEO v2 W1: log the engine source so post-run telemetry shows whether
    // we ran against DataForSEO (snapshot rows + share-of-voice) or the
    // direct-provider fallback. The total snapshot row count for this run
    // is harder to count without a ScanRun model, so we surface a tail
    // sample instead — sufficient signal for cron health.
    const engineSource = resolveEngineSource();
    const recentSnapshotCount =
      engineSource === "dataforseo"
        ? await prisma.aeoMentionSnapshot.count({
            where: { capturedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
          })
        : 0;

    return {
      result: NextResponse.json({
        ok: true,
        totalRows,
        engineSource,
        recentSnapshotCount,
        neighborhoodPagesScanned,
        neighborhoodPagesSkipped,
        orgs: summary,
      }),
      recordsProcessed: totalRows,
    };
  });
}
