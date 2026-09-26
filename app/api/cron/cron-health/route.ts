import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { findNewlyStuckCrons } from "@/lib/health/cron-streaks";
import {
  AGENCY_ADMIN_EMAIL,
  APP_URL,
  buildBaseHtml,
  escapeHtml,
  isValidEmail,
  sendBrandedEmail,
} from "@/lib/email/shared";

export const maxDuration = 60;

// Look back far enough that a daily cron's previous run is in the window,
// so a job that was already failing yesterday is not re-alerted as "new".
const LOOKBACK_MS = 26 * 60 * 60 * 1000;

// GET /api/cron/cron-health
// Hourly. Emails ops once when any cron has been partial/error/timeout on
// every run for over an hour (CronRun rows written by recordCronRun). The
// /admin/system page shows the same data; this makes it push, not pull.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("cron-health", async () => {
    const now = new Date();
    const runs = await prisma.cronRun.findMany({
      where: {
        startedAt: { gte: new Date(now.getTime() - LOOKBACK_MS) },
        NOT: { jobName: "cron-health" },
      },
      select: { jobName: true, startedAt: true, status: true },
    });
    const stuck = findNewlyStuckCrons(runs, now);

    let alerted = false;
    let alertError: string | null = null;
    if (stuck.length > 0) {
      console.error("[cron-health] crons failing for over an hour", stuck);
      if (!isValidEmail(AGENCY_ADMIN_EMAIL)) {
        alertError = "AGENCY_ADMIN_EMAIL invalid";
      } else {
        const rows = stuck
          .map(
            (s) =>
              `<li><strong>${escapeHtml(s.jobName)}</strong>: ${escapeHtml(s.status)} on the last ${s.badRuns} run(s), since ${escapeHtml(s.badSince.toISOString())}</li>`,
          )
          .join("");
        const subject = `Cron alert: ${stuck.map((s) => s.jobName).join(", ")} failing for over an hour`;
        const sent = await sendBrandedEmail({
          to: AGENCY_ADMIN_EMAIL,
          subject,
          html: buildBaseHtml({
            headline: "Crons failing for over an hour",
            bodyHtml: `<p>These jobs have not had a clean run in over an hour:</p><ul>${rows}</ul>`,
            ctaText: "Open system health",
            ctaUrl: `${APP_URL}/admin/system`,
            preheader: subject,
            title: subject,
          }),
          category: "transactional",
          template: "cron-health-alert",
        });
        alerted = sent.ok;
        if (!sent.ok) alertError = sent.error;
      }
    }

    return {
      result: NextResponse.json({
        ok: true,
        checkedRuns: runs.length,
        stuck,
        alerted,
        alertError,
      }),
      recordsProcessed: stuck.length,
      // An alert we could not deliver must not read as a clean run.
      errorCount: alertError ? 1 : 0,
    };
  });
}
