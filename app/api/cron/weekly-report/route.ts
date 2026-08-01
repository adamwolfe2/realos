import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordCronRun } from "@/lib/health/cron-run";
import { generateReportSnapshot, resolvePeriod } from "@/lib/reports/generate";
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

    // A single shared `now` for the whole run so every org resolves the
    // exact same periodStart (previously each org's generateReportSnapshot
    // call used its own new Date(), so the dedup key could drift by
    // milliseconds between orgs processed at different points in the loop).
    // That also lets us batch-fetch every existing-report dedup row in one
    // query up front — skipping generateReportSnapshot entirely (its own
    // heavy per-org queries) for orgs already drafted this period, instead
    // of the old per-org findFirst() after doing the expensive work anyway.
    const runNow = new Date();
    const { periodStart: sharedPeriodStart } = resolvePeriod("weekly", runNow);
    // Resolved once for the whole run (single-agency instance, same lookup
    // notifyDraftSubmitted uses) — notifyReportDraftReady is operator-voiced
    // and must land in the agency's inbox, not the client org's.
    const agencyOrg = await prisma.organization
      .findFirst({ where: { orgType: "AGENCY" }, select: { id: true }, orderBy: { createdAt: "asc" } })
      .catch(() => null);
    const orgIds = orgs.map((o) => o.id);
    const existingReports =
      orgIds.length > 0
        ? await prisma.clientReport.findMany({
            where: {
              orgId: { in: orgIds },
              kind: "weekly",
              periodStart: sharedPeriodStart,
            },
            select: { orgId: true },
          })
        : [];
    const alreadyDrafted = new Set(existingReports.map((r) => r.orgId));

    for (const org of orgs) {
      try {
        if (alreadyDrafted.has(org.id)) {
          skipped += 1;
          continue;
        }

        const snapshot = await generateReportSnapshot(org.id, "weekly", {
          now: runNow,
        });
        const periodStart = new Date(snapshot.periodStart);
        const periodEnd = new Date(snapshot.periodEnd);

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

        // Suppressed (not client org.id) if no agency org resolves — an
        // empty-DB edge case; the draft still exists, only the bell ping
        // is skipped rather than misrouting it to the client.
        if (agencyOrg) {
          await notifyReportDraftReady(agencyOrg.id, report.id, "weekly").catch(() => {
            // fire-and-forget: don't fail the draft just because the bell is down
          });
        }

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
