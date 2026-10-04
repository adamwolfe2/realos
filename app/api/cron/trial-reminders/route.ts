import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrgType, SubscriptionStatus } from "@prisma/client";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";
import { applyGoLive } from "@/lib/billing/go-live-trial";
import { hasCardOnFile } from "@/lib/billing/trial-status";
import { BILLABLE_LIFECYCLES, trialQuote } from "@/lib/billing/trial-quote";
import {
  buildTrialReminder,
  isAfterHours,
  pickTrialStage,
  type TrialRecap,
  type TrialStage,
} from "@/lib/billing/trial-reminders";
import {
  buildBaseHtml,
  getResend,
  isValidEmail,
  FROM_EMAIL,
  APP_URL,
  BRAND_EMAIL,
} from "@/lib/email/shared";

export const maxDuration = 300;

// ---------------------------------------------------------------------------
// /api/cron/trial-reminders — daily at 10:00 UTC.
//
// Walks every CLIENT org with subscriptionStatus=TRIALING and a
// trialEndsAt set. First runs the go-live sweep (applyGoLive), then sends at
// most one reminder per stage (copy + timing in lib/billing/trial-reminders):
//
//   day_7       results recap, 7 days after go-live (or trial start)
//   t_minus_3   exact charge + date + manage/cancel, or "live features
//               pause, your data stays" when no card is on file
//   expired     soft-landing note (one-shot)
//
// Dedup: AuditEvent with entityType="TrialReminderSent" + entityId
// keyed on stage + trialStartedAt blocks repeats. A new trial start
// resets the dedup window so retries after cancellation work.
// ---------------------------------------------------------------------------

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
        subscriptionStatus: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    });

    const resend = getResend();
    const now = new Date();

    // Compute (org, stage, dedupId) for every candidate up front — pickStage
    // is pure/local, no DB needed — then batch-fetch every dedup AuditEvent
    // in a single query instead of one findFirst() per org. Replaces the
    // N+1 pattern the sibling billing-reminders cron already fixed.
    const candidates: Array<{
      org: (typeof orgs)[number] & {
        trialEndsAt: Date;
        primaryContactEmail: string;
      };
      stage: TrialStage;
      dedupId: string;
      goLiveAt: Date | null;
      cardOnFile: boolean;
    }> = [];
    for (const rawOrg of orgs) {
      scanned += 1;
      // Go-live sweep for operators who don't log in (the portal layout
      // does the same on visit). May extend trialEndsAt; never shortens.
      let snap: Awaited<ReturnType<typeof applyGoLive>> = null;
      try {
        snap = await applyGoLive(rawOrg.id, now);
      } catch (err) {
        errors += 1;
        errorMessages.push(
          `${rawOrg.id} go-live: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      const org = { ...rawOrg, trialEndsAt: snap?.trialEndsAt ?? rawOrg.trialEndsAt };
      if (!org.trialEndsAt || !org.primaryContactEmail) continue;
      if (!isValidEmail(org.primaryContactEmail)) continue;
      const goLiveAt = snap?.goLiveAt ?? null;
      const cardOnFile = snap?.cardOnFile ?? hasCardOnFile(org);
      const stage = pickTrialStage(now, {
        trialEndsAt: org.trialEndsAt,
        anchor: goLiveAt ?? org.trialStartedAt,
        cardOnFile,
      });
      if (!stage) continue;
      const startedAtMarker = org.trialStartedAt?.toISOString() ?? "unknown";
      // A card added after the no-card T-3 note still gets the charge
      // notice (amount + date), so card state is part of the T-3 key.
      const stageKey =
        stage === "t_minus_3" && cardOnFile ? "t_minus_3_card" : stage;
      candidates.push({
        org: { ...org, trialEndsAt: org.trialEndsAt, primaryContactEmail: org.primaryContactEmail },
        stage,
        dedupId: `trial:${stageKey}:${startedAtMarker}`,
        goLiveAt,
        cardOnFile,
      });
    }

    const candidateOrgIds = candidates.map((c) => c.org.id);
    const candidateDedupIds = candidates.map((c) => c.dedupId);
    const existingEvents =
      candidates.length > 0
        ? await prisma.auditEvent.findMany({
            where: {
              orgId: { in: candidateOrgIds },
              entityType: "TrialReminderSent",
              entityId: { in: candidateDedupIds },
            },
            select: { orgId: true, entityId: true },
          })
        : [];
    const alreadySent = new Set(
      existingEvents.map((e) => `${e.orgId}:${e.entityId}`),
    );

    // One grouped query replaces a property.count per org in the send loop.
    const propertyCountRows =
      candidates.length > 0
        ? await prisma.property.groupBy({
            by: ["orgId"],
            where: {
              orgId: { in: candidateOrgIds },
              lifecycle: { in: [...BILLABLE_LIFECYCLES] },
            },
            _count: { _all: true },
          })
        : [];
    const propertyCountByOrg = new Map(
      propertyCountRows.map((r) => [r.orgId, r._count._all]),
    );

    for (const { org, stage, dedupId, goLiveAt, cardOnFile } of candidates) {
      if (alreadySent.has(`${org.id}:${dedupId}`)) continue;

      try {
        if (!resend) throw new Error("Resend not configured");
        const quote = trialQuote(
          org.chosenTier ?? org.subscriptionTier ?? null,
          propertyCountByOrg.get(org.id) ?? 0,
        );
        const recap =
          stage === "day_7"
            ? await loadRecap(org.id, goLiveAt ?? org.trialStartedAt ?? now)
            : undefined;
        const reminder = buildTrialReminder({
          stage,
          recipientName: org.primaryContactName ?? org.name,
          orgName: org.name,
          trialEndsAt: org.trialEndsAt,
          planName: quote?.planName ?? null,
          monthlyCents: quote?.monthlyCents ?? null,
          cardOnFile,
          appUrl: APP_URL,
          recap,
        });
        const html = buildBaseHtml({
          headline: reminder.headline,
          bodyHtml: `${reminder.bodyHtml}
      <p style="margin-top:24px;color:#64748B;font-size:13px;">
        Questions? Reply to this email or write to ${BRAND_EMAIL}. We respond
        the same business day.
      </p>`,
          ctaText: reminder.ctaText,
          ctaUrl: reminder.ctaUrl,
        });

        await resend.emails.send({
          from: FROM_EMAIL,
          to: org.primaryContactEmail,
          subject: reminder.subject,
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

async function loadRecap(orgId: string, since: Date): Promise<TrialRecap> {
  const [leads, conversations] = await Promise.all([
    prisma.lead.count({ where: { orgId, createdAt: { gte: since } } }),
    prisma.chatbotConversation.findMany({
      where: { orgId, createdAt: { gte: since } },
      select: { createdAt: true },
      take: 5000,
    }),
  ]);
  return {
    leads,
    conversations: conversations.length,
    afterHoursConversations: conversations.filter((c) => isAfterHours(c.createdAt)).length,
  };
}
