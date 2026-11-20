import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordCronRun } from "@/lib/health/cron-run";
import { generateReportSnapshot, resolvePeriod } from "@/lib/reports/generate";
import { generateShareToken } from "@/lib/reports/token";
import { sendReportEmail } from "@/lib/email/send-report";
import { notifyReportDraftReady } from "@/lib/notifications/create";
import { verifyCronAuth } from "@/lib/cron/auth";
import { planScheduledReportUnits, unitKey } from "@/lib/reports/scheduled";

const DEDUP_WINDOW_MS = 12 * 60 * 60 * 1000;

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
// Orgs with 2+ ACTIVE properties also get one draft per ACTIVE property.
// Idempotency: keyed on (org, property) — a unit already drafted for this
// month's period window is skipped (lib/reports/scheduled.ts).
//
// Auth: Bearer CRON_SECRET.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("monthly-report", async () => {
    // Budget counts from handler start so slow setup queries eat into it.
    const startedAt = Date.now();
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

    // A single shared `now` for the whole run so every org resolves the
    // exact same periodStart (previously each org's generateReportSnapshot
    // call used its own new Date(), so the dedup key could drift by
    // milliseconds between orgs processed at different points in the loop).
    // That also lets us batch-fetch every existing-report dedup row in one
    // query up front — skipping generateReportSnapshot entirely (its own
    // heavy per-org queries) for orgs already reported this period, instead
    // of the old per-org findFirst() after doing the expensive work anyway.
    const runNow = new Date();
    const { periodStart: sharedPeriodStart } = resolvePeriod("monthly", runNow);
    // Resolved once for the whole run (single-agency instance, same lookup
    // notifyDraftSubmitted uses) — notifyReportDraftReady is operator-voiced
    // and must land in the agency's inbox, not the client org's.
    const agencyOrg = await prisma.organization
      .findFirst({ where: { orgType: "AGENCY" }, select: { id: true }, orderBy: { createdAt: "asc" } })
      .catch(() => null);
    // One unit per (org, property): org-wide draft for every org, plus one
    // per ACTIVE property when the org has 2+. See lib/reports/scheduled.ts
    // for the dedup key and stalest-first order.
    const orgById = new Map(orgs.map((o) => [o.id, o]));
    const { due, alreadyDrafted } = await planScheduledReportUnits({
      kind: "monthly",
      orgIds: orgs.map((o) => o.id),
      periodStart: sharedPeriodStart,
      dedupWindowMs: DEDUP_WINDOW_MS,
    });
    skipped += alreadyDrafted;

    // Stop starting new units with headroom before maxDuration (300s); one
    // in-flight unit (sections + 30s AI + send) still has to finish. Units
    // left over are picked up by the second scheduled run, which skips
    // units already drafted (see DEDUP_WINDOW_MS).
    const deadline = startedAt + 200_000;
    const deferred: string[] = [];
    for (const unit of due) {
      const org = orgById.get(unit.orgId);
      if (!org) continue;
      if (Date.now() > deadline) {
        deferred.push(unitKey(unit));
        continue;
      }
      try {

        // Auto-send ONLY on explicit opt-in (matches weekly-report cron),
        // and only the org-wide draft: the recipient list is org-level.
        // Everyone else gets a draft + operator notification — the operator
        // reviews and shares manually, exactly as the Reports UI promises.
        const autoSend =
          !unit.propertyId &&
          org.reportAutoSend &&
          org.reportCadence === "monthly" &&
          (org.reportRecipients?.length ?? 0) > 0;

        const snapshot = await generateReportSnapshot(org.id, "monthly", {
          now: runNow,
          ...(unit.propertyId ? { propertyId: unit.propertyId } : {}),
        });
        const periodStart = new Date(snapshot.periodStart);

        const shareToken = generateShareToken();

        // Always create as "draft" first — mirrors weekly-report. "sent" is
        // not a real status the rest of the app understands: /r/[token]
        // 404s and the portal share link stays null unless status is
        // "shared". Only flip to "shared" (+ sharedAt) once the email
        // actually goes out.
        const report = await prisma.clientReport.create({
          data: {
            orgId: org.id,
            ...(unit.propertyId ? { propertyId: unit.propertyId } : {}),
            kind: "monthly",
            periodStart,
            periodEnd: new Date(snapshot.periodEnd),
            snapshot: snapshot as object as never,
            shareToken,
            status: "draft",
          },
        });

        if (autoSend) {
          const result = await sendReportEmail({
            to: org.reportRecipients ?? [],
            orgName: org.name,
            orgLogoUrl: org.logoUrl,
            snapshot,
            shareToken,
            senderName: "LeaseStack",
          });
          if (result.ok) {
            await prisma.clientReport.update({
              where: { id: report.id },
              data: { status: "shared", sharedAt: new Date() },
            });
            sent += 1;
          } else {
            if (agencyOrg) {
              await notifyReportDraftReady(agencyOrg.id, report.id, "monthly").catch(() => {
                // Notification failure must not fail the run; the draft exists.
              });
            }
            errors.push({
              orgId: org.id,
              error:
                result.error ??
                (result.skipped === "no_resend_key"
                  ? "RESEND_API_KEY not configured"
                  : "send failed"),
            });
            skipped += 1;
          }
        } else {
          // One bell per org per run: only the org-wide draft pings.
          if (agencyOrg && !unit.propertyId) {
            await notifyReportDraftReady(agencyOrg.id, report.id, "monthly").catch(() => {
              // Notification failure must not fail the run; the draft exists.
            });
          }
          skipped += 1;
        }
      } catch (err) {
        errors.push({
          orgId: unitKey(unit),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      result: NextResponse.json({ ok: true, orgs: orgs.length, sent, skipped, deferred, errors }),
      recordsProcessed: sent,
      // Deferred orgs count so a run that never reaches them shows partial.
      errorCount: errors.length + deferred.length,
      errorSummary: [
        ...errors.map((e) => `${e.orgId}: ${e.error}`),
        ...(deferred.length ? [`deferred (time budget): ${deferred.join(", ")}`] : []),
      ].join("; "),
    };
  });
}
