import "server-only";
import { prisma } from "@/lib/db";
import { LeaseStatus } from "@prisma/client";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";

const MIN_PROPERTIES = 3;
const MIN_LEASES_PER_PROPERTY = 5;

/**
 * Rent vs portfolio detector.
 *
 * Cross-property pricing comparison. For each property with ≥5 active
 * leases, computes the average per-unit rent and compares it to the
 * portfolio average. Flags properties priced ≥15% below portfolio (likely
 * leaving money on the table) or ≥15% above (might be over-priced if
 * occupancy is also down).
 *
 * Conservative: only fires when the portfolio has ≥3 properties so we
 * have enough comparison signal. Weekly dedupeKey.
 */
export const rentVsPortfolioDetector: Detector = {
  name: "rent-vs-portfolio",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const weekKey = isoWeekKey(new Date());

    // Pull active leases per property with rent.
    const leases = await prisma.lease.findMany({
      where: {
        orgId,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
        monthlyRentCents: { gt: 0 },
      },
      select: {
        propertyId: true,
        monthlyRentCents: true,
        property: { select: { name: true, totalUnits: true, availableCount: true } },
      },
    });

    if (leases.length === 0) return [];

    // Bucket per property + compute avg.
    const buckets = new Map<
      string,
      {
        propertyId: string;
        propertyName: string;
        totalUnits: number | null;
        availableUnits: number | null;
        leaseCount: number;
        totalRentCents: number;
      }
    >();

    for (const lease of leases) {
      if (!lease.monthlyRentCents) continue;
      const existing = buckets.get(lease.propertyId);
      if (existing) {
        existing.leaseCount += 1;
        existing.totalRentCents += lease.monthlyRentCents;
      } else {
        buckets.set(lease.propertyId, {
          propertyId: lease.propertyId,
          propertyName: lease.property.name,
          totalUnits: lease.property.totalUnits,
          availableUnits: lease.property.availableCount,
          leaseCount: 1,
          totalRentCents: lease.monthlyRentCents,
        });
      }
    }

    const eligible = Array.from(buckets.values()).filter(
      (b) => b.leaseCount >= MIN_LEASES_PER_PROPERTY,
    );
    if (eligible.length < MIN_PROPERTIES) return [];

    // Portfolio average rent per unit.
    const totalRent = eligible.reduce((s, b) => s + b.totalRentCents, 0);
    const totalLeases = eligible.reduce((s, b) => s + b.leaseCount, 0);
    const portfolioAvg = totalRent / totalLeases;

    const insights: DetectedInsight[] = [];

    for (const b of eligible) {
      const avgRent = b.totalRentCents / b.leaseCount;
      const deltaPct = ((avgRent - portfolioAvg) / portfolioAvg) * 100;

      // Below portfolio by ≥15% — pricing opportunity.
      if (deltaPct <= -15) {
        const liftPotentialCents = Math.round(
          (portfolioAvg - avgRent) * b.leaseCount,
        );
        insights.push({
          kind: "portfolio_outlier",
          category: "occupancy",
          severity: "info",
          title: `${b.propertyName} rent is ${Math.abs(Math.round(deltaPct))}% below your portfolio average`,
          body: `Average rent at ${b.propertyName}: $${Math.round(avgRent / 100).toLocaleString()}/mo. Your portfolio average across comparable properties: $${Math.round(portfolioAvg / 100).toLocaleString()}/mo. Closing the gap on next renewal could lift monthly rent roll by ~$${Math.round(liftPotentialCents / 100).toLocaleString()}.`,
          suggestedAction:
            "Pull comp data for the local submarket. If the property is comparable to your portfolio average, raise renewal pricing in 25–50 dollar increments. If amenities or unit quality differs, leave it.",
          propertyId: b.propertyId,
          entityType: "property",
          entityId: b.propertyId,
          href: `/portal/properties/${b.propertyId}`,
          dedupeKey: `rent_below_portfolio:${b.propertyId}:week:${weekKey}`,
          context: {
            propertyId: b.propertyId,
            propertyName: b.propertyName,
            avgRentUsd: Math.round(avgRent / 100),
            portfolioAvgUsd: Math.round(portfolioAvg / 100),
            deltaPct: Math.round(deltaPct * 10) / 10,
            liftPotentialMonthlyUsd: Math.round(liftPotentialCents / 100),
          },
        });
      }

      // Above portfolio by ≥15% AND has open vacancy — possibly over-priced.
      if (
        deltaPct >= 15 &&
        b.availableUnits != null &&
        b.availableUnits > 0
      ) {
        insights.push({
          kind: "portfolio_outlier",
          category: "occupancy",
          severity: "warning",
          title: `${b.propertyName} rent is ${Math.round(deltaPct)}% above portfolio with ${b.availableUnits} unit${b.availableUnits === 1 ? "" : "s"} sitting`,
          body: `Average rent at ${b.propertyName}: $${Math.round(avgRent / 100).toLocaleString()}/mo vs portfolio average $${Math.round(portfolioAvg / 100).toLocaleString()}/mo. With ${b.availableUnits} unit${b.availableUnits === 1 ? "" : "s"} currently available, you may be priced above what the market will absorb.`,
          suggestedAction:
            "Check days-on-market on the available units. If they're sitting 30+ days, consider a $50–100 reduction or a free-month concession to break the freeze. Then rebuild pricing on next signed lease.",
          propertyId: b.propertyId,
          entityType: "property",
          entityId: b.propertyId,
          href: `/portal/properties/${b.propertyId}`,
          dedupeKey: `rent_above_portfolio:${b.propertyId}:week:${weekKey}`,
          context: {
            propertyId: b.propertyId,
            propertyName: b.propertyName,
            avgRentUsd: Math.round(avgRent / 100),
            portfolioAvgUsd: Math.round(portfolioAvg / 100),
            deltaPct: Math.round(deltaPct * 10) / 10,
            availableUnits: b.availableUnits,
          },
        });
      }
    }

    return insights;
  },
};
