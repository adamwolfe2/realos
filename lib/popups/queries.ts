import "server-only";
import { prisma } from "@/lib/db";
import {
  PopupCampaign,
  PopupEvent,
  PopupEventType,
  PopupStatus,
  Prisma,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Popup module — server-side query layer. Mirrors the lib/dashboard/queries.ts
// shape (one file, one consistent return shape per surface). Every helper is
// tenant-scoped on orgId. Callers fan helpers out via Promise.all.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Public projection used in the list view + nav badge. Drops the larger
 * text fields (body, ctaUrl, etc.) so the list query stays fast.
 */
export type PopupListRow = Pick<
  PopupCampaign,
  | "id"
  | "name"
  | "status"
  | "headline"
  | "ctaText"
  | "offerCode"
  | "trigger"
  | "position"
  | "primaryColor"
  | "shownCount"
  | "convertedCount"
  | "ctaClickCount"
  | "dismissedCount"
  | "updatedAt"
  | "propertyId"
>;

export async function listPopups(orgId: string): Promise<PopupListRow[]> {
  return prisma.popupCampaign.findMany({
    where: { orgId, status: { not: PopupStatus.ARCHIVED } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      status: true,
      headline: true,
      ctaText: true,
      offerCode: true,
      trigger: true,
      position: true,
      primaryColor: true,
      shownCount: true,
      convertedCount: true,
      ctaClickCount: true,
      dismissedCount: true,
      updatedAt: true,
      propertyId: true,
    },
  });
}

export async function getPopupById(
  orgId: string,
  id: string,
): Promise<PopupCampaign | null> {
  return prisma.popupCampaign.findFirst({
    where: { id, orgId },
  });
}

/**
 * Active campaigns the embed needs to consider for a given page load.
 * Returns whatever's `status === ACTIVE` and not property-scoped, plus
 * anything scoped to a property whose slug matches the embed's
 * `data-property` attribute. The embed picks the FIRST match that
 * passes its frequency cap.
 */
export async function getActivePopupsForEmbed(
  orgId: string,
  propertySlug: string | null,
): Promise<PopupCampaign[]> {
  // Resolve propertySlug to id once so the where clause stays cheap.
  // A missing property is treated as "org-wide only" — never errors.
  let propertyId: string | null = null;
  if (propertySlug) {
    const prop = await prisma.property.findFirst({
      where: { orgId, slug: propertySlug },
      select: { id: true },
    });
    propertyId = prop?.id ?? null;
  }

  return prisma.popupCampaign.findMany({
    where: {
      orgId,
      status: PopupStatus.ACTIVE,
      OR: [
        { propertyId: null },
        ...(propertyId ? [{ propertyId }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Aggregate analytics across the org. Drives the dashboard tile on
 * /portal home and the summary strip on /portal/popups.
 */
export async function getPopupSummary(orgId: string) {
  const since28d = new Date(Date.now() - 28 * DAY_MS);
  const [counts, recent] = await Promise.all([
    prisma.popupCampaign.aggregate({
      where: { orgId, status: { not: PopupStatus.ARCHIVED } },
      _sum: {
        shownCount: true,
        ctaClickCount: true,
        convertedCount: true,
        dismissedCount: true,
      },
      _count: { _all: true },
    }),
    prisma.popupEvent.groupBy({
      by: ["type"],
      where: { orgId, occurredAt: { gte: since28d } },
      _count: { _all: true },
    }),
  ]);

  const recentByType = new Map<PopupEventType, number>();
  for (const r of recent) recentByType.set(r.type, r._count._all);

  const shown = counts._sum.shownCount ?? 0;
  const converted = counts._sum.convertedCount ?? 0;
  const ctr =
    shown > 0
      ? Math.round((converted / shown) * 1000) / 10
      : null;

  return {
    totalCampaigns: counts._count._all,
    shownAllTime: shown,
    convertedAllTime: converted,
    ctaClickAllTime: counts._sum.ctaClickCount ?? 0,
    dismissedAllTime: counts._sum.dismissedCount ?? 0,
    conversionRatePct: ctr,
    shown28d: recentByType.get(PopupEventType.SHOWN) ?? 0,
    converted28d: recentByType.get(PopupEventType.CONVERTED) ?? 0,
    ctaClicks28d: recentByType.get(PopupEventType.CTA_CLICKED) ?? 0,
  };
}

/**
 * Per-day event series for the campaign detail chart. Returns a
 * day-by-day rollup of SHOWN / CTA_CLICKED / CONVERTED for the
 * requested window.
 */
export async function getCampaignDailySeries(
  orgId: string,
  campaignId: string,
  rangeDays: number,
): Promise<
  Array<{
    date: string;
    shown: number;
    clicked: number;
    converted: number;
  }>
> {
  const start = new Date(Date.now() - rangeDays * DAY_MS);
  const events = await prisma.popupEvent.findMany({
    where: { orgId, campaignId, occurredAt: { gte: start } },
    select: { type: true, occurredAt: true },
  });
  const buckets = new Map<
    string,
    { shown: number; clicked: number; converted: number }
  >();
  for (let i = 0; i < rangeDays; i += 1) {
    const d = new Date(Date.now() - (rangeDays - 1 - i) * DAY_MS);
    d.setUTCHours(0, 0, 0, 0);
    buckets.set(d.toISOString(), { shown: 0, clicked: 0, converted: 0 });
  }
  for (const e of events) {
    const day = new Date(e.occurredAt);
    day.setUTCHours(0, 0, 0, 0);
    const key = day.toISOString();
    const b = buckets.get(key);
    if (!b) continue;
    if (e.type === PopupEventType.SHOWN) b.shown += 1;
    if (e.type === PopupEventType.CTA_CLICKED) b.clicked += 1;
    if (e.type === PopupEventType.CONVERTED) b.converted += 1;
  }
  return Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    ...v,
  }));
}

/**
 * Internal counter helpers for the public events endpoint. Keep the
 * denormalized counters on PopupCampaign in sync with PopupEvent
 * inserts so the list view doesn't need a groupBy on every render.
 *
 * Caller is responsible for tenant-scoping — these helpers TRUST
 * `orgId` because they're only called from validated server code.
 */
export async function recordPopupEvent(input: {
  orgId: string;
  campaignId: string;
  type: PopupEventType;
  sessionId?: string;
  anonymousId?: string;
  leadId?: string;
  pageUrl?: string;
  referrer?: string;
}): Promise<PopupEvent> {
  return prisma.$transaction(async (tx) => {
    const event = await tx.popupEvent.create({
      data: {
        orgId: input.orgId,
        campaignId: input.campaignId,
        type: input.type,
        sessionId: input.sessionId,
        anonymousId: input.anonymousId,
        leadId: input.leadId,
        pageUrl: input.pageUrl,
        referrer: input.referrer,
      },
    });
    const counterField: Prisma.PopupCampaignUpdateInput = {};
    if (input.type === PopupEventType.SHOWN) {
      counterField.shownCount = { increment: 1 };
    } else if (input.type === PopupEventType.DISMISSED) {
      counterField.dismissedCount = { increment: 1 };
    } else if (input.type === PopupEventType.CTA_CLICKED) {
      counterField.ctaClickCount = { increment: 1 };
    } else if (input.type === PopupEventType.CONVERTED) {
      counterField.convertedCount = { increment: 1 };
    }
    await tx.popupCampaign.update({
      where: { id: input.campaignId },
      data: counterField,
    });
    return event;
  });
}
