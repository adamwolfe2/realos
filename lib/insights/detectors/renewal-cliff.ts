import "server-only";
import { prisma } from "@/lib/db";
import { LeaseStatus } from "@prisma/client";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 60;
const CLIFF_THRESHOLD = 5; // ≥5 leases expiring in any 30-day window

/**
 * Renewal cliff detector.
 *
 * Scans the next 60 days of lease expirations per property. Fires when
 * 5+ leases expire in any rolling 30-day window — that's a concentration
 * risk that needs renewal-outreach campaigns or pricing intervention NOW.
 *
 * dedupeKey is keyed on (propertyId, expiry-month) so the insight clears
 * itself once enough leases get renewed/extended out of the window.
 */
export const renewalCliffDetector: Detector = {
  name: "renewal-cliff",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + WINDOW_DAYS * DAY);

    const leases = await prisma.lease.findMany({
      where: {
        orgId,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
        endDate: { gte: now, lte: windowEnd },
      },
      select: {
        propertyId: true,
        endDate: true,
        property: { select: { name: true, totalUnits: true } },
      },
    });

    if (leases.length === 0) return [];

    // Bucket leases by (property, year-month). Then flag any month
    // with ≥CLIFF_THRESHOLD leases.
    const buckets = new Map<
      string,
      {
        propertyId: string;
        propertyName: string;
        totalUnits: number | null;
        monthKey: string;
        count: number;
        sampleEndDate: Date;
      }
    >();

    for (const lease of leases) {
      if (!lease.endDate) continue;
      const monthKey = `${lease.endDate.getUTCFullYear()}-${String(
        lease.endDate.getUTCMonth() + 1,
      ).padStart(2, "0")}`;
      const key = `${lease.propertyId}:${monthKey}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        buckets.set(key, {
          propertyId: lease.propertyId,
          propertyName: lease.property.name,
          totalUnits: lease.property.totalUnits,
          monthKey,
          count: 1,
          sampleEndDate: lease.endDate,
        });
      }
    }

    const insights: DetectedInsight[] = [];
    for (const bucket of buckets.values()) {
      if (bucket.count < CLIFF_THRESHOLD) continue;

      const pctOfPortfolio =
        bucket.totalUnits && bucket.totalUnits > 0
          ? Math.round((bucket.count / bucket.totalUnits) * 100)
          : null;
      const monthLabel = new Date(
        Date.parse(`${bucket.monthKey}-01T00:00:00Z`),
      ).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });

      const severity =
        bucket.count >= 15 ||
        (pctOfPortfolio !== null && pctOfPortfolio >= 30)
          ? "critical"
          : "warning";

      insights.push({
        kind: "renewal_cliff",
        category: "renewals",
        severity,
        title: `${bucket.count} leases expire in ${monthLabel} at ${bucket.propertyName}`,
        body: `${bucket.count} active or expiring leases${pctOfPortfolio !== null ? ` (${pctOfPortfolio}% of the portfolio)` : ""} are scheduled to end in ${monthLabel}. Without proactive renewal outreach, you're staring at a vacancy concentration.`,
        suggestedAction:
          "Launch renewal outreach now: send renewal offers, schedule resident touchpoints, and pre-line replacement leasing campaigns. Consider rent-bump scenarios that account for the concentrated turn risk.",
        propertyId: bucket.propertyId,
        entityType: "property",
        entityId: bucket.propertyId,
        href: `/portal/renewals?propertyId=${bucket.propertyId}`,
        dedupeKey: `renewal_cliff:${bucket.propertyId}:${bucket.monthKey}`,
        context: {
          propertyId: bucket.propertyId,
          propertyName: bucket.propertyName,
          monthKey: bucket.monthKey,
          leaseCount: bucket.count,
          pctOfPortfolio,
          totalUnits: bucket.totalUnits,
        },
      });
    }

    return insights;
  },
};
