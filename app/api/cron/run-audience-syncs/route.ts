import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordCronRun } from "@/lib/health/cron-run";
import { executeSegmentPush } from "@/lib/actions/audiences";
import { computeNextRunAt } from "@/lib/audiences/schedule";
import type { GeoFilter } from "@/lib/integrations/al-segments";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// Hard cap per tick to avoid Vercel function timeouts. Hourly cadence + cap of
// 100 means we comfortably handle thousands of schedules with multiple ticks.
const MAX_SCHEDULES_PER_TICK = 100;

// GET /api/cron/run-audience-syncs
//
// Hourly cron registered in vercel.json. Scans for due AudienceSyncSchedule
// rows, runs the push for each (using executeSegmentPush — the auth-free
// internal that backs pushSegmentToDestination), and advances nextRunAt.
//
// Auth: Bearer CRON_SECRET, matching the rest of the cron suite.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("run-audience-syncs", async () => {
    const startedAt = Date.now();
    const now = new Date();

    // Reaper: flip orphan RUNNING runs to FAILED. A row stays RUNNING if the
    // lambda was killed mid-push (timeout, OOM, deploy). Without this, the
    // history UI shows a forever-spinning run.
    const REAPER_AGE_MS = 15 * 60 * 1000; // 15 min
    const reaperCutoff = new Date(Date.now() - REAPER_AGE_MS);
    await prisma.audienceSyncRun.updateMany({
      where: {
        status: "RUNNING",
        startedAt: { lt: reaperCutoff },
      },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: "Lambda terminated before push completed",
      },
    }).catch(() => {
      // Reaper failure is non-fatal — proceed with the tick.
    });

    const due = await prisma.audienceSyncSchedule.findMany({
      where: { enabled: true, nextRunAt: { lte: now } },
      orderBy: { nextRunAt: "asc" },
      take: MAX_SCHEDULES_PER_TICK,
    });

    let successes = 0;
    let failures = 0;

    for (const schedule of due) {
      try {
        const filter = (schedule.filterSnapshot as GeoFilter | null) ?? undefined;
        const result = await executeSegmentPush({
          orgId: schedule.orgId,
          segmentId: schedule.segmentId,
          destinationId: schedule.destinationId,
          geoFilter: filter,
          // System-triggered runs have no userId.
          triggeredByUserId: null,
        });
        if (result.ok) {
          successes++;
        } else {
          failures++;
        }
      } catch {
        // executeSegmentPush already records the failure on AudienceSyncRun
        // when reachable; a bare throw here means something deeper failed
        // (DB unreachable, missing module). We still want to advance
        // nextRunAt so we don't hot-loop on a broken schedule.
        failures++;
      }

      // Always advance nextRunAt and stamp lastRunAt — even on failure — so a
      // single broken schedule can't block its own future runs.
      const nextRunAt = computeNextRunAt(
        schedule.frequency,
        schedule.dayOfWeek ?? null,
        schedule.hourUtc,
        new Date(),
      );
      await prisma.audienceSyncSchedule
        .updateMany({
          where: { id: schedule.id, enabled: true },
          data: { lastRunAt: new Date(), nextRunAt },
        })
        .catch(() => {
          // Swallow — losing a single nextRunAt update isn't fatal; next tick
          // will reattempt the same schedule.
        });
    }

    const durationMs = Date.now() - startedAt;
    return {
      result: NextResponse.json({
        runs: due.length,
        successes,
        failures,
        durationMs,
      }),
      recordsProcessed: successes,
    };
  });
}
