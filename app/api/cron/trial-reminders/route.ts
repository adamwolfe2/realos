import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrgType, SubscriptionStatus } from "@prisma/client";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";
import {
  buildBaseHtml,
  getResend,
  isValidEmail,
  FROM_EMAIL,
  BRAND_NAME,
  BRAND_EMAIL,
} from "@/lib/email/shared";

export const maxDuration = 300;

// ---------------------------------------------------------------------------
// /api/cron/trial-reminders — daily at 10:00 UTC.
//
// Walks every CLIENT org with subscriptionStatus=TRIALING and a
// trialEndsAt set. For each trial we may send one of four reminder
// emails:
//
//   ~7 days remaining   "Here's what you've built so far"
//   ~2 days remaining   "Trial ends in 2 days"
//   ~1 day remaining    "Trial ends tomorrow"
//   expired             "Your trial has ended" (one-shot)
//
// Dedup: AuditEvent with entityType="TrialReminderSent" + entityId
// keyed on stage + trialStartedAt blocks repeats. A new trial start
// resets the dedup window so retries after cancellation work.
// ---------------------------------------------------------------------------

type Stage = "day_7" | "day_2" | "day_1" | "expired";

function pickStage(now: Date, ends: Date): Stage | null {
  const ms = ends.getTime() - now.getTime();
  if (ms < 0) return "expired";
  const daysLeft = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (daysLeft <= 1) return "day_1";
  if (daysLeft <= 2) return "day_2";
  if (daysLeft <= 7 && daysLeft >= 6) return "day_7";
  return null;
}

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("trial-reminders", async () => {
    let sent = 0;
    let scanned = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    const orgs = await prisma.organization.findMany({
      where: {
        orgType: OrgType.CLIENT,
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialEndsAt: { not: null },
        primaryContactEmail: { not: null },
      },
      select: {
        id: true,
        name: true,
        primaryContactEmail: true,
        primaryContactName: true,
        chosenTier: true,
        subscriptionTier: true,
        trialStartedAt: true,
        trialEndsAt: true,
      },
    });

    const resend = getResend();
    const now = new Date();

    for (const org of orgs) {
      scanned += 1;
      if (!org.trialEndsAt || !org.primaryContactEmail) continue;
      if (!isValidEmail(org.primaryContactEmail)) continue;

      const stage = pickStage(now, org.trialEndsAt);
      if (!stage) continue;

      const startedAtMarker = org.trialStartedAt?.toISOString() ?? "unknown";
      const dedupId = `trial:${stage}:${startedAtMarker}`;
      const existing = await prisma.auditEvent.findFirst({
        where: {
          orgId: org.id,
          entityType: "TrialReminderSent",
          entityId: dedupId,
        },
        select: { id: true },
      });
      if (existing) continue;

      try {
        if (!resend) throw new Error("Resend not configured");
        const tier = (org.chosenTier ?? org.subscriptionTier ?? null) as
          | "STARTER"
          | "GROWTH"
          | "SCALE"
          | "CUSTOM"
          | null;
        const tierLabel =
          tier === "STARTER"
            ? "Foundation"
            : tier === "GROWTH"
              ? "Growth"
              : tier === "SCALE"
                ? "Scale"
                : "your plan";

        const html = buildHtml({
          stage,
          tierLabel,
          recipientName: org.primaryContactName ?? org.name,
          orgName: org.name,
          trialEndsAt: org.trialEndsAt,
        });

        await resend.emails.send({
          from: FROM_EMAIL,
          to: org.primaryContactEmail,
          subject: buildSubject(stage, tierLabel),
          html,
          headers: {
            "List-Unsubscribe": `<mailto:unsubscribe@leasestack.co>, <${process.env.NEXT_PUBLIC_APP_URL ?? "https://leasestack.co"}/unsub?email=${encodeURIComponent(org.primaryContactEmail)}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            "X-Entity-Ref-ID": `trial-${stage}-${org.id}`,
          },
          tags: [
            { name: "template", value: `trial-reminder-${stage}` },
            { name: "category", value: "broadcast" },
          ],
        });

        await prisma.auditEvent.create({
          data: {
            orgId: org.id,
            action: "CREATE",
            entityType: "TrialReminderSent",
            entityId: dedupId,
            description: `Sent trial reminder (${stage}) to ${org.primaryContactEmail}`,
            diff: {
              stage,
              trialEndsAt: org.trialEndsAt.toISOString(),
            },
          },
        });

        sent += 1;
      } catch (err) {
        errors += 1;
        errorMessages.push(
          `${org.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      result: {
        ok: errors === 0,
        scanned,
        sent,
        errors,
        errors_preview: errorMessages.slice(0, 5),
      },
      recordsProcessed: sent,
    };
  }).then(
    (result) => NextResponse.json(result),
    (err) =>
      NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      ),
  );
}

function buildSubject(stage: Stage, tierLabel: string): string {
  switch (stage) {
    case "day_7":
      return `Your ${BRAND_NAME} trial: a week left on ${tierLabel}`;
    case "day_2":
      return `2 days left in your ${BRAND_NAME} trial`;
    case "day_1":
      return `Last day of your ${BRAND_NAME} trial`;
    case "expired":
      return `Your ${BRAND_NAME} trial has ended`;
  }
}

function buildHtml(opts: {
  stage: Stage;
  tierLabel: string;
  recipientName: string;
  orgName: string;
  trialEndsAt: Date;
}): string {
  const { stage, tierLabel, recipientName, orgName, trialEndsAt } = opts;
  const activateUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://leasestack.co"}/portal/billing`;

  const headline =
    stage === "day_7"
      ? `One week left in your ${BRAND_NAME} trial.`
      : stage === "day_2"
        ? `Two days to lock in ${tierLabel}.`
        : stage === "day_1"
          ? `Last day to activate.`
          : `Your trial has ended.`;

  const body =
    stage === "day_7"
      ? `Hi ${recipientName} — a quick check-in. Your ${tierLabel} trial for ${orgName} runs through ${trialEndsAt.toLocaleDateString()}. You have a workspace, your properties, and the platform unlocked. If you have connected your data and run a few reports, you are in great shape. Add a payment method now to keep everything flowing once the trial ends.`
      : stage === "day_2"
        ? `Hi ${recipientName} — just 2 days left on your ${BRAND_NAME} trial. Activate now and your workspace stays unlocked the moment the trial ends. No interruption, no manual reactivation. Activating mid-trial gives you full credit for the remaining days.`
        : stage === "day_1"
          ? `Hi ${recipientName} — today is the last day of your trial. Activate by end of day and you keep everything in flight. If you let the trial lapse, your workspace shifts to read-only until you reactivate.`
          : `Hi ${recipientName} — your trial has ended. Your workspace is now in read-only mode, but every property, lead, and report is preserved. Activate any time to restore full access.`;

  return buildBaseHtml({
    headline,
    bodyHtml: `
      <p>${body}</p>
      <p style="margin-top:24px;color:#64748B;font-size:13px;">
        Questions? Reply to this email or write to ${BRAND_EMAIL}. We respond
        the same business day.
      </p>
    `,
    ctaText: `Activate ${tierLabel}`,
    ctaUrl: activateUrl,
  });
}
