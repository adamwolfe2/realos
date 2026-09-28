import "server-only";

import { AuditAction, OrgType, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  computeGoLiveTrialEnd,
  hasCardOnFile,
} from "@/lib/billing/trial-status";

// ---------------------------------------------------------------------------
// Go-live trial (plans/go-live-trial slice 1).
//
// A trialing workspace "goes live" the first time it gets real value: a
// chatbot conversation, an AppFolio sync, or a pixel hit. At that moment the
// 14-day clock starts (capped at signup + 30d, never shorter than today's end;
// math in computeGoLiveTrialEnd). The moment is recorded once as an
// AuditEvent marker so the card prompt and the day-7 recap can anchor on it.
//
// Called from the portal layout (instant, on visit) and the daily
// trial-reminders cron (catches operators who don't log in).
// ---------------------------------------------------------------------------

export const GO_LIVE_MARKER = "TrialGoLive";

export type TrialSnapshot = {
  goLiveAt: Date | null;
  trialEndsAt: Date | null;
  cardOnFile: boolean;
};

async function hasGoLiveSignal(orgId: string): Promise<boolean> {
  const [chat, appfolio, pixel] = await Promise.all([
    prisma.chatbotConversation.findFirst({
      where: { orgId },
      select: { id: true },
    }),
    prisma.appFolioIntegration.findFirst({
      where: { orgId, lastSyncAt: { not: null } },
      select: { id: true },
    }),
    prisma.cursiveIntegration.findFirst({
      where: { orgId, lastPixelHitAt: { not: null } },
      select: { id: true },
    }),
  ]);
  return Boolean(chat || appfolio || pixel);
}

// Returns null for orgs that aren't CLIENT trials. Never throws for "not
// live yet"; DB errors propagate to the caller.
export async function applyGoLive(
  orgId: string,
  now: Date = new Date(),
): Promise<TrialSnapshot | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      orgType: true,
      subscriptionStatus: true,
      trialStartedAt: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });
  if (
    !org ||
    org.orgType !== OrgType.CLIENT ||
    org.subscriptionStatus !== SubscriptionStatus.TRIALING
  ) {
    return null;
  }
  const cardOnFile = hasCardOnFile(org);
  const snapshot = (goLiveAt: Date | null, trialEndsAt = org.trialEndsAt) => ({
    goLiveAt,
    trialEndsAt,
    cardOnFile,
  });

  const marker = await prisma.auditEvent.findFirst({
    where: { entityType: GO_LIVE_MARKER, entityId: orgId },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (marker) return snapshot(marker.createdAt);

  const expired = org.trialEndsAt !== null && org.trialEndsAt <= now;
  if (expired || !(await hasGoLiveSignal(orgId))) return snapshot(null);

  const next = computeGoLiveTrialEnd({
    trialStartedAt: org.trialStartedAt,
    trialEndsAt: org.trialEndsAt,
    goLiveAt: now,
    cardOnFile,
  });

  // ponytail: two concurrent first calls can both write a marker; the
  // earliest wins on read and the trialEndsAt guard below keeps the date
  // write single. Add a unique marker row if duplicates ever matter.
  await prisma.$transaction([
    ...(next
      ? [
          prisma.organization.updateMany({
            // Optimistic guard: only move the end we just read, and only
            // while still trialing (a webhook may have landed in between).
            where: {
              id: orgId,
              subscriptionStatus: SubscriptionStatus.TRIALING,
              trialEndsAt: org.trialEndsAt,
            },
            data: { trialEndsAt: next },
          }),
        ]
      : []),
    prisma.auditEvent.create({
      data: {
        orgId,
        action: AuditAction.UPDATE,
        entityType: GO_LIVE_MARKER,
        entityId: orgId,
        description: next
          ? `Workspace went live; trial now ends ${next.toISOString()}`
          : "Workspace went live; trial end unchanged",
        diff: {
          trialEndsAt: {
            from: org.trialEndsAt?.toISOString() ?? null,
            to: (next ?? org.trialEndsAt)?.toISOString() ?? null,
          },
          cardOnFile,
        },
      },
    }),
  ]);

  return snapshot(now, next ?? org.trialEndsAt);
}
