import "server-only";
import { prisma } from "@/lib/db";
import { LeadSource, LeadStatus } from "@prisma/client";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";
import { propertyIdsToWhere } from "@/lib/tenancy/property-filter";
import { budgetShift } from "@/lib/integrations/ads-insights-math";
import { realAdAccountWhere } from "@/lib/integrations/real-ad-account";

const DAY = 86_400_000;
const WINDOW_DAYS = 28;

function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

/**
 * Budget shift between properties.
 *
 * Over the last 28 days, compares cost per signed lease (property's own
 * campaign spend / ad-sourced signed leases) across the enabled buildings.
 * Fires when the priciest is at least 2x the cheapest and both have 2+
 * leases, so the number is not one lucky lease. Keyed weekly.
 *
 * A recommendation only: LeaseStack never moves budget itself.
 */
export const adBudgetShiftDetector: Detector = {
  name: "ad-budget-shift",
  async run(orgId: string, propertyIds: string[]): Promise<DetectedInsight[]> {
    const since = new Date(Date.now() - WINDOW_DAYS * DAY);
    // Same "real account" rule as the dashboard: seeded, uncredentialed
    // accounts never drive a recommendation.
    const realAccount = await realAdAccountWhere(orgId);
    const campaigns = await prisma.adCampaign.findMany({
      where: { orgId, ...propertyIdsToWhere(propertyIds), adAccount: realAccount },
      select: { id: true, propertyId: true, property: { select: { name: true } } },
    });
    const linked = campaigns.filter((c) => c.propertyId);
    if (linked.length === 0) return [];

    const [spend, signed] = await Promise.all([
      prisma.adMetricDaily.groupBy({
        by: ["campaignId"],
        where: {
          orgId, // property-scope: org-level — campaign ids above are already limited to enabled properties
          campaignId: { in: linked.map((c) => c.id) },
          date: { gte: since },
        },
        _sum: { spendCents: true },
      }),
      prisma.lead.groupBy({
        by: ["propertyId"],
        where: {
          orgId,
          ...propertyIdsToWhere(propertyIds),
          source: { in: [LeadSource.GOOGLE_ADS, LeadSource.META_ADS] },
          status: LeadStatus.SIGNED,
          createdAt: { gte: since },
        },
        _count: { _all: true },
      }),
    ]);

    const byProperty = new Map<string, { propertyId: string; name: string; spendCents: number; signed: number }>();
    const campaignById = new Map(linked.map((c) => [c.id, c]));
    for (const row of spend) {
      const c = campaignById.get(row.campaignId);
      if (!c?.propertyId) continue;
      const r = byProperty.get(c.propertyId) ?? { propertyId: c.propertyId, name: c.property?.name ?? "Property", spendCents: 0, signed: 0 };
      r.spendCents += row._sum.spendCents ?? 0;
      byProperty.set(c.propertyId, r);
    }
    for (const row of signed) {
      const r = row.propertyId ? byProperty.get(row.propertyId) : undefined;
      if (r) r.signed += row._count._all;
    }

    const shift = budgetShift([...byProperty.values()]);
    if (!shift) return [];
    const ratio = Math.round(shift.ratio * 10) / 10;

    return [
      {
        kind: "ad_budget_shift",
        category: "ads",
        severity: "info",
        title: `${shift.from.name} pays ${ratio}x more per signed lease than ${shift.to.name}`,
        body: `Over the last ${WINDOW_DAYS} days, ads for ${shift.from.name} cost ${dollars(shift.from.costPerLeaseCents)} per signed lease, against ${dollars(shift.to.costPerLeaseCents)} at ${shift.to.name}.`,
        suggestedAction: `Try moving part of ${shift.from.name}'s budget to ${shift.to.name} for two weeks and compare. Check ${shift.from.name}'s pricing and landing page first: a high cost per lease can come from the unit, not the ads.`,
        propertyId: shift.from.id,
        entityType: "property",
        entityId: shift.from.id,
        href: `/portal/ads?property=${shift.from.id}`,
        dedupeKey: `ad_budget_shift:week:${isoWeekKey(new Date())}`,
        context: {
          fromPropertyId: shift.from.id,
          fromCostPerLeaseUsd: Math.round(shift.from.costPerLeaseCents / 100),
          toPropertyId: shift.to.id,
          toCostPerLeaseUsd: Math.round(shift.to.costPerLeaseCents / 100),
          ratio,
          actionLabel: `See ${shift.from.name} ads →`,
        },
      },
    ];
  },
};
