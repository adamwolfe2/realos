import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordCronRun } from "@/lib/health/cron-run";
import { generateReportSnapshot } from "@/lib/reports/generate";
import { generateShareToken } from "@/lib/reports/token";
import { notifyReportDraftReady } from "@/lib/notifications/create";
import { verifyCronAuth } from "@/lib/cron/auth";
import { sendReportEmail } from "@/lib/email/send-report";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// GET /api/cron/weekly-report
//
// Runs every Monday at 07:00 UTC (see vercel.json). For every active client
// it generates a DRAFT weekly report covering the prior Mon-Sun window and
// fires a Notification telling the operator their review is pending.
//
// White-glove constraint: this never auto-sends the report to the client. The
// operator opens the draft, adds a headline + personal note, then chooses to
// share the public link or email it via the portal.
//
// Idempotency: if a draft weekly report already exists for this week's
// periodStart the run skips that org.
//
// Auth: Bearer CRON_SECRET.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("weekly-report", async () => {
    const orgs = await prisma.organization.findMany({
      where: {
        orgType: "CLIENT",
        status: { in: ["LAUNCHED", "ACTIVE", "AT_RISK"] },
      },
      // Norman bug #100: pull the cadence config so the cron can honor
      // auto-send + recipients per-org. We still draft for every CLIENT
      // org (so the operator's portal inbox stays fresh whether or not
      // they've opted into auto-send); auto-send only fires for orgs
      // where reportAutoSend=true AND reportCadence="weekly".
      select: {
        id: true,
        name: true,
        logoUrl: true,
        reportCadence: true,
        reportAutoSend: true,
        reportRecipients: true,
      },
    });

    let drafted = 0;
    let skipped = 0;
    let autoSent = 0;
    const errors: { orgId: string; error: string }[] = [];
    const autoSendSkipped: { orgId: string; reason: string }[] = [];

    for (const org of orgs) {
      try {
        const snapshot = await generateReportSnapshot(org.id, "weekly");
        const periodStart = new Date(snapshot.periodStart);
        const periodEnd = new Date(snapshot.periodEnd);

        // Idempotency: skip if we already drafted a weekly for this window.
        const existing = await prisma.clientReport.findFirst({
          where: {
            orgId: org.id,
            kind: "weekly",
            periodStart,
          },
          select: { id: true },
        });
        if (existing) {
          skipped += 1;
          continue;
        }

        const report = await prisma.clientReport.create({
          data: {
            orgId: org.id,
            kind: "weekly",
            periodStart,
            periodEnd,
            snapshot: snapshot as object as never,
            shareToken: generateShareToken(),
            status: "draft",
          },
          select: { id: true, shareToken: true },
        });

        await notifyReportDraftReady(org.id, report.id, "weekly").catch(() => {
          // fire-and-forget: don't fail the draft just because the bell is down
        });

        drafted += 1;

        // Auto-send when the org opted into weekly auto-send and has at
        // least one recipient configured. Surface the skip reason on the
        // cron run log so a half-configured org is visible — it never
        // fails silently.
        if (org.reportAutoSend && org.reportCadence === "weekly") {
          const recipients = org.reportRecipients ?? [];
          if (recipients.length === 0) {
            autoSendSkipped.push({
              orgId: org.id,
              reason: "auto-send on, no recipients configured",
            });
          } else {
            try {
              const result = await sendReportEmail({
                to: recipients,
                orgName: org.name,
                orgLogoUrl: org.logoUrl,
                snapshot,
                shareToken: report.shareToken,
                senderName: "LeaseStack",
              });
              if (result.ok) {
                await prisma.clientReport.update({
                  where: { id: report.id },
                  data: { status: "shared", sharedAt: new Date() },
                });
                autoSent += 1;
              } else {
                autoSendSkipped.push({
                  orgId: org.id,
                  reason:
                    result.error ??
                    (result.skipped === "no_resend_key"
                      ? "RESEND_API_KEY not configured"
                      : "send failed"),
                });
              }
            } catch (sendErr) {
              autoSendSkipped.push({
                orgId: org.id,
                reason:
                  sendErr instanceof Error
                    ? `send failed: ${sendErr.message}`
                    : "send failed",
              });
            }
          }
        }
      } catch (err) {
        errors.push({
          orgId: org.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      result: NextResponse.json({
        ok: true,
        orgs: orgs.length,
        drafted,
        skipped,
        autoSent,
        autoSendSkipped,
        errors,
      }),
      recordsProcessed: drafted,
    };
  });
}
