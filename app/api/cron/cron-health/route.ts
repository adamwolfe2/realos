import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { CHRONIC_AFTER_MS, findFailingCrons, splitChronic } from "@/lib/health/cron-streaks";
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
// Daily (vercel.json). One digest email listing crons whose latest runs have
// been partial/error/timeout for over an hour. Jobs with no clean run in 7
// days are left out (they stay on /admin/system) so a known-broken job does
// not mail ops every day. Was hourly per-streak alerts: ~1 email a day of
// the same failures.
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
    const failing = findFailingCrons(runs, now);
    const recentOk =
      failing.length > 0
        ? await prisma.cronRun.findMany({
            where: {
              jobName: { in: failing.map((s) => s.jobName) },
              status: "ok",
              startedAt: { gte: new Date(now.getTime() - CHRONIC_AFTER_MS) },
            },
            distinct: ["jobName"],
            select: { jobName: true },
          })
        : [];
    const { fresh: stuck, chronic } = splitChronic(
      failing,
      new Set(recentOk.map((r) => r.jobName)),
    );

    let alerted = false;
    let alertError: string | null = null;
    if (stuck.length > 0) {
      console.error("[cron-health] crons failing", { stuck, chronic });
      if (!isValidEmail(AGENCY_ADMIN_EMAIL)) {
        alertError = "AGENCY_ADMIN_EMAIL invalid";
      } else {
        const rows = stuck
          .map(
            (s) =>
              `<li><strong>${escapeHtml(s.jobName)}</strong>: ${escapeHtml(s.status)} on the last ${s.badRuns} run(s), since ${escapeHtml(s.badSince.toISOString())}</li>`,
          )
          .join("");
        const subject = `Daily cron digest: ${stuck.length} job${stuck.length === 1 ? "" : "s"} failing`;
        const chronicNote = chronic.length
          ? `<p>Also failing all week (not repeated here daily): ${chronic.map((s) => escapeHtml(s.jobName)).join(", ")}.</p>`
          : "";
        const sent = await sendBrandedEmail({
          to: AGENCY_ADMIN_EMAIL,
          subject,
          html: buildBaseHtml({
            headline: "Crons failing",
            bodyHtml: `<p>These jobs have not had a clean run in over an hour:</p><ul>${rows}</ul>${chronicNote}`,
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
        chronic,
        alerted,
        alertError,
      }),
      recordsProcessed: stuck.length,
      // An alert we could not deliver must not read as a clean run.
      errorCount: alertError ? 1 : 0,
    };
  });
}
