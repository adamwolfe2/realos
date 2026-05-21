import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { syncPropertyFromDataforSeo } from "@/lib/seo/sync-orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Pro caps at 300s. A single DataforSEO scan including Lighthouse
// + 4 SERP calls + competitors + backlinks averages 60-90s, so the
// worker comfortably finishes one job per tick.
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// GET /api/cron/seo-scan-worker
//
// Drains the SeoScanJob queue. Runs every minute (vercel.json cron) and
// behaves in three phases:
//
//   1. REAPER — flips RUNNING jobs older than 10 minutes back to QUEUED
//      with attempts++. Catches workers that died mid-run (timeout, OOM,
//      Vercel platform blip). After 3 attempts we mark FAILED instead so
//      a broken property doesn't loop forever.
//
//   2. CLAIM — atomically claims the oldest QUEUED row by trying an
//      updateMany(where: { status: QUEUED, id: <picked> }) and checking
//      the returned count. If another worker claimed it first we just
//      exit cleanly — next tick will pick the next row.
//
//   3. RUN — invokes syncPropertyFromDataforSeo with an onProgress
//      callback that persists progressStage + progressPct back to the
//      job row. Operator UI polls /api/portal/seo/scan/[id]/status and
//      surfaces this as "Querying competitors… (4/10)".
//
// Concurrency: one job per tick keeps us well under Vercel's 300s
// ceiling and gives every property an honest progress UX. Bumping to N
// concurrent jobs requires moving to `SKIP LOCKED` via prisma.$queryRaw
// — fine, but not needed at our portfolio size.
// ---------------------------------------------------------------------------

const STUCK_RUNNING_THRESHOLD_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export async function GET(req: NextRequest) {
  const authResponse = verifyCronAuth(req);
  if (authResponse) return authResponse;

  return recordCronRun<NextResponse>("seo-scan-worker", async () => {
    const startedAt = Date.now();

    // -----------------------------------------------------------------------
    // 1. REAPER — recycle dead-RUNNING rows.
    // -----------------------------------------------------------------------
    const stuckCutoff = new Date(Date.now() - STUCK_RUNNING_THRESHOLD_MS);
    const stuck = await prisma.seoScanJob.findMany({
      where: {
        status: "RUNNING",
        startedAt: { lt: stuckCutoff },
      },
      select: { id: true, attempts: true },
    });
    let recycled = 0;
    let abandoned = 0;
    for (const j of stuck) {
      if (j.attempts + 1 >= MAX_ATTEMPTS) {
        await prisma.seoScanJob
          .update({
            where: { id: j.id },
            data: {
              status: "FAILED",
              error: "Exceeded max attempts after stuck-RUNNING reaping",
              finishedAt: new Date(),
              attempts: { increment: 1 },
            },
          })
          .catch(() => null);
        abandoned += 1;
      } else {
        await prisma.seoScanJob
          .update({
            where: { id: j.id },
            data: {
              status: "QUEUED",
              attempts: { increment: 1 },
              startedAt: null,
              progressStage: "Re-queued after timeout",
              progressPct: 0,
            },
          })
          .catch(() => null);
        recycled += 1;
      }
    }

    // -----------------------------------------------------------------------
    // 2. CLAIM the oldest QUEUED row atomically.
    // -----------------------------------------------------------------------
    const candidate = await prisma.seoScanJob.findFirst({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, orgId: true, propertyId: true, attempts: true },
    });

    if (!candidate) {
      return {
        result: NextResponse.json({
          ok: true,
          idle: true,
          recycled,
          abandoned,
          durationMs: Date.now() - startedAt,
        }),
        recordsProcessed: recycled + abandoned,
      };
    }

    // Atomic claim — only flip QUEUED→RUNNING if no one else got here first.
    const claim = await prisma.seoScanJob.updateMany({
      where: { id: candidate.id, status: "QUEUED" },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        progressStage: "Starting DataforSEO scan",
        progressPct: 1,
      },
    });
    if (claim.count === 0) {
      // Another worker claimed it. Exit clean.
      return {
        result: NextResponse.json({
          ok: true,
          raced: true,
          recycled,
          abandoned,
          durationMs: Date.now() - startedAt,
        }),
        recordsProcessed: recycled + abandoned,
      };
    }

    // -----------------------------------------------------------------------
    // 3. RUN the orchestrator with progress callbacks.
    // -----------------------------------------------------------------------
    try {
      const stats = await syncPropertyFromDataforSeo({
        orgId: candidate.orgId,
        propertyId: candidate.propertyId,
        async onProgress({ stage, pct }) {
          await prisma.seoScanJob
            .update({
              where: { id: candidate.id },
              data: { progressStage: stage, progressPct: pct },
            })
            .catch(() => null);
        },
      });
      await prisma.seoScanJob.update({
        where: { id: candidate.id },
        data: {
          status: "DONE",
          progressStage: "Scan complete",
          progressPct: 100,
          finishedAt: new Date(),
          result: stats as unknown as object,
        },
      });
      // Also bump Property.lastSyncedAt so downstream dashboards know the
      // scan landed.
      await prisma.property
        .update({
          where: { id: candidate.propertyId },
          data: { lastSyncedAt: new Date() },
        })
        .catch(() => null);

      return {
        result: NextResponse.json({
          ok: true,
          jobId: candidate.id,
          stats,
          recycled,
          abandoned,
          durationMs: Date.now() - startedAt,
        }),
        recordsProcessed:
          stats.serpQueriesScanned +
          stats.lighthouseAudits +
          stats.backlinkSummaries +
          stats.competitorRows,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Decide between re-queue (recoverable) and FAILED (no more attempts).
      const nextAttempts = candidate.attempts + 1;
      if (nextAttempts < MAX_ATTEMPTS) {
        await prisma.seoScanJob
          .update({
            where: { id: candidate.id },
            data: {
              status: "QUEUED",
              attempts: nextAttempts,
              startedAt: null,
              progressStage: `Retry ${nextAttempts}/${MAX_ATTEMPTS} after error`,
              progressPct: 0,
              error: message,
            },
          })
          .catch(() => null);
      } else {
        await prisma.seoScanJob
          .update({
            where: { id: candidate.id },
            data: {
              status: "FAILED",
              attempts: nextAttempts,
              finishedAt: new Date(),
              error: message,
            },
          })
          .catch(() => null);
      }
      console.error("[seo-scan-worker]", candidate.id, message);
      return {
        result: NextResponse.json({
          ok: false,
          jobId: candidate.id,
          error: message,
          willRetry: nextAttempts < MAX_ATTEMPTS,
          recycled,
          abandoned,
          durationMs: Date.now() - startedAt,
        }),
        recordsProcessed: 0,
      };
    }
  });
}
