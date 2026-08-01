import "server-only";
import { prisma } from "@/lib/db";
import { PopupEventType, PopupStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Popup performance section for ClientReport snapshots. Extracted out of
// lib/reports/generate.ts (already 3000+ lines) — same pattern as
// lib/recency.ts and lib/properties/queries.ts, which generate.ts already
// imports from. Mirrors the Shown/CTA clicks/Converted/Dismissed rollup the
// /portal/popups KPI strip computes (lib/popups/queries.ts:getPopupSummary),
// but period-scoped to the report window instead of a fixed 28d.
// ---------------------------------------------------------------------------

export type ReportPopupStats = {
  shown: number;
  ctaClicks: number;
  converted: number;
  dismissed: number;
  conversionRate: number | null; // converted / shown, rounded to a whole number — the only renderer (pct() in snapshot-shared.tsx) rounds again, so a stored decimal is noise; null when shown=0
};

/**
 * Returns undefined when the org has no popup campaigns at all, so existing
 * reports (generated before this section shipped, or for orgs that never
 * built a popup) don't render an empty "0 shown, 0 clicks" block. Once at
 * least one non-archived campaign exists, the section always renders —
 * even with all-zero counts for the period — because a live campaign with
 * zero engagement this period is itself a real signal.
 */
export async function buildPopupStats(
  orgId: string,
  propertyId: string | null,
  periodStart: Date,
  periodEnd: Date,
): Promise<ReportPopupStats | undefined> {
  const campaigns = await prisma.popupCampaign.findMany({
    where: {
      orgId,
      status: { not: PopupStatus.ARCHIVED },
      // Property-scoped reports include org-wide campaigns (propertyId
      // null fires on every property) plus campaigns scoped to this
      // property — same inclusion rule the /portal/popups list and the
      // embed's getActivePopupsForEmbed use.
      ...(propertyId ? { OR: [{ propertyId: null }, { propertyId }] } : {}),
    },
    select: { id: true },
  });
  if (campaigns.length === 0) return undefined;

  const campaignIds = campaigns.map((c) => c.id);
  const counts = await prisma.popupEvent.groupBy({
    by: ["type"],
    where: {
      orgId,
      campaignId: { in: campaignIds },
      occurredAt: { gte: periodStart, lt: periodEnd },
    },
    _count: { _all: true },
  });

  const byType = new Map(counts.map((c) => [c.type, c._count._all]));
  const shown = byType.get(PopupEventType.SHOWN) ?? 0;
  const ctaClicks = byType.get(PopupEventType.CTA_CLICKED) ?? 0;
  const converted = byType.get(PopupEventType.CONVERTED) ?? 0;
  const dismissed = byType.get(PopupEventType.DISMISSED) ?? 0;

  return {
    shown,
    ctaClicks,
    converted,
    dismissed,
    conversionRate: shown > 0 ? Math.round((converted / shown) * 100) : null,
  };
}
