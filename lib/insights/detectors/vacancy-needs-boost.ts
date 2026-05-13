import "server-only";
import { prisma } from "@/lib/db";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const STALE_VACANCY_DAYS = 7;
const MIN_AVAILABLE_UNITS = 1;

/**
 * Vacancy-needs-boost detector.
 *
 * Per property: flags when there's at least one available unit AND no
 * active ad campaign for the property AND the property has been open for
 * >7 days. The signal is "you're sitting on inventory and not advertising."
 *
 * dedupeKey rotates weekly so the operator gets a fresh nudge each week
 * the property remains uncovered. Once they launch a campaign or fill
 * the unit, autoResolve cleans the insight.
 */
export const vacancyNeedsBoostDetector: Detector = {
  name: "vacancy-needs-boost",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const weekKey = isoWeekKey(new Date());

    // Pull every property with available inventory and at least one
    // listing that's been on the market for >7 days. We use the
    // earliest-listed unit's createdAt as the "vacancy age" proxy —
    // not perfect but the closest signal we have without unit-level
    // turnover history.
    const properties = await prisma.property.findMany({
      where: {
        orgId,
        availableCount: { gte: MIN_AVAILABLE_UNITS },
      },
      select: {
        id: true,
        name: true,
        availableCount: true,
        totalUnits: true,
        createdAt: true,
        listings: {
          where: { isAvailable: true },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { createdAt: true },
        },
        adCampaigns: {
          where: {
            status: { in: ["ENABLED", "ACTIVE"] },
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    const insights: DetectedInsight[] = [];
    for (const property of properties) {
      // Skip if there's already an active ad campaign for this property —
      // not a "needs boost" situation, the operator is already trying.
      if (property.adCampaigns.length > 0) continue;

      const oldestListingAt =
        property.listings[0]?.createdAt ?? property.createdAt;
      const ageDays = Math.floor(
        (Date.now() - oldestListingAt.getTime()) / DAY,
      );
      if (ageDays < STALE_VACANCY_DAYS) continue;

      const available = property.availableCount ?? 0;
      const pctVacant =
        property.totalUnits && property.totalUnits > 0
          ? Math.round((available / property.totalUnits) * 100)
          : null;

      const severity =
        ageDays >= 30 || (pctVacant !== null && pctVacant >= 20)
          ? "warning"
          : "info";

      insights.push({
        kind: "vacancy_needs_boost",
        category: "occupancy",
        severity,
        title: `${available} unit${available === 1 ? "" : "s"} sitting at ${property.name} with no active ads`,
        body: `${available}${pctVacant !== null ? ` (${pctVacant}% of the portfolio)` : ""} unit${available === 1 ? " has" : "s have"} been available for ~${ageDays} days. There's no active Google or Meta ad campaign for this property to drive replacement traffic.`,
        suggestedAction:
          "Launch an Ads campaign for this property — even a small budget on Google Search ads can lift tour volume within 48 hours. If the listing is stale on photo or pricing, fix that first.",
        propertyId: property.id,
        entityType: "property",
        entityId: property.id,
        href: `/portal/ads?propertyId=${property.id}`,
        dedupeKey: `vacancy_needs_boost:${property.id}:week:${weekKey}`,
        context: {
          propertyId: property.id,
          propertyName: property.name,
          availableUnits: available,
          totalUnits: property.totalUnits,
          pctVacant,
          ageDays,
        },
      });
    }

    return insights;
  },
};
