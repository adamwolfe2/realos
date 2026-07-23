import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordCronRun } from "@/lib/health/cron-run";
import { generateReportSnapshot } from "@/lib/reports/generate";
import { generateShareToken } from "@/lib/reports/token";
import { sendReportEmail } from "@/lib/email/send-report";
import { notifyReportDraftReady } from "@/lib/notifications/create";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// GET /api/cron/monthly-report
//
// Runs on the 1st of each month at 08:00 UTC (see vercel.json). For every
// active client org, generates a monthly snapshot as a DRAFT and notifies
// the operator to review it. It only auto-emails the client when the org
// explicitly opted in via /portal/reports/settings (reportAutoSend=true AND
// reportCadence="monthly" AND a configured recipient list) — mirroring the
// weekly cron. 2026-07-22 deep-audit P0: the previous behaviour auto-sent
// unreviewed numbers to primaryContactEmail with no draft stage, directly
// contradicting the Reports UI promise "Nothing is sent automatically".
//
// Idempotency: skips orgs that already have a monthly ClientReport for
// the current calendar month's period window.
//
// Auth: Bearer CRON_SECRET.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("monthly-report", async () => {
    const orgs = await prisma.organization.findMany({
      where: {
        orgType: "CLIENT",
        status: { in: ["LAUNCHED", "ACTIVE", "AT_RISK"] },
        // Norman bug #100: include orgs that have EITHER a configured
        // recipient list (via /portal/reports/settings) OR a legacy
        // primaryContactEmail. The recipient list wins below.
        OR: [
          { primaryContactEmail: { not: null } },
          { reportRecipients: { isEmpty: false } },
        ],
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        primaryContactEmail: true,
        primaryContactName: true,
        reportCadence: true,
        reportRecipients: true,
        reportAutoSend: true,
      },
    });

    let sent = 0;
    let skipped = 0;
    const errors: { orgId: string; error: string }[] = [];

    for (const org of orgs) {
      try {
        // Auto-send ONLY on explicit opt-in (matches weekly-report cron).
        // Everyone else gets a draft + operator notification — the operator
        // reviews and shares manually, exactly as the Reports UI promises.
        const autoSend =
          org.reportAutoSend &&
          org.reportCadence === "monthly" &&
          (org.reportRecipients?.length ?? 0) > 0;

        const snapshot = await generateReportSnapshot(org.id, "monthly");
        const periodStart = new Date(snapshot.periodStart);

        const existing = await prisma.clientReport.findFirst({
          where: { orgId: org.id, kind: "monthly", periodStart },
          select: { id: true },
        });
        if (existing) {
          skipped += 1;
          continue;
        }

        const shareToken = generateShareToken();

        const report = await prisma.clientReport.create({
          data: {
            orgId: org.id,
            kind: "monthly",
            periodStart,
            periodEnd: new Date(snapshot.periodEnd),
            snapshot: snapshot as object as never,
            shareToken,
            status: autoSend ? "sent" : "draft",
          },
        });

        if (autoSend) {
          await sendReportEmail({
            to: org.reportRecipients ?? [],
            orgName: org.name,
            orgLogoUrl: org.logoUrl,
            snapshot,
            shareToken,
            senderName: "LeaseStack",
          });
          sent += 1;
        } else {
          await notifyReportDraftReady(org.id, report.id, "monthly").catch(() => {
            // Notification failure must not fail the run; the draft exists.
          });
          skipped += 1;
        }
      } catch (err) {
        errors.push({
          orgId: org.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      result: NextResponse.json({ ok: true, orgs: orgs.length, sent, skipped, errors }),
      recordsProcessed: sent,
    };
  });
}
