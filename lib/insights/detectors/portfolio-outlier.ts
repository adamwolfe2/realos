import "server-only";
import { prisma } from "@/lib/db";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const MIN_PROPERTIES = 3; // need ≥3 properties to compare meaningfully
const MIN_LEADS_FOR_COMPARISON = 5;

/**
 * Portfolio outlier detector.
 *
 * Cross-property comparison. Once a portfolio has ≥3 properties with
 * leasing activity, identify the property generating disproportionately
 * MORE leads (best performer worth copying) AND the property generating
 * disproportionately FEWER (worth deprioritizing or auditing).
 *
 * This detector is the LeaseStack moat — competitors don't surface
 * portfolio benchmarks because they're built for single-property
 * operators. Multi-property + multi-region operators see this insight
 * the moment their second/third property has 28d of data.
 *
 * Fires once per week per direction (best, worst). dedupeKey rotates
 * weekly so the operator gets a fresh comparison.
 */
export const portfolioOutlierDetector: Detector = {
  name: "portfolio-outlier",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const since = new Date(Date.now() - 28 * DAY);
    const weekKey = isoWeekKey(new Date());

    // Count leads per property in the last 28d. Group at the DB level
    // so we don't fan-in 1000 leads then aggregate in JS.
    const leadCounts = await prisma.lead.groupBy({
      by: ["propertyId"],
      where: { orgId, createdAt: { gte: since } },
      _count: { _all: true },
    });

    const validRows = leadCounts.filter(
      (r) => r.propertyId !== null,
    ) as Array<{ propertyId: string; _count: { _all: number } }>;

    if (validRows.length < MIN_PROPERTIES) return [];

    const totalLeads = validRows.reduce(
      (sum, r) => sum + r._count._all,
      0,
    );
    if (totalLeads < MIN_LEADS_FOR_COMPARISON * validRows.length) {
      return [];
    }

    const avg = totalLeads / validRows.length;
    const sorted = [...validRows].sort(
      (a, b) => b._count._all - a._count._all,
    );
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    // Only emit if there's genuine separation — best is ≥2x average AND
    // worst is ≤50% of average. Otherwise the portfolio is healthy and
    // there's nothing to flag.
    const insights: DetectedInsight[] = [];

    const propertyMap = new Map(
      (
        await prisma.property.findMany({
          where: {
            orgId,
            id: { in: validRows.map((r) => r.propertyId) },
          },
          select: { id: true, name: true },
        })
      ).map((p) => [p.id, p.name]),
    );

    if (best._count._all >= avg * 2) {
      const name = propertyMap.get(best.propertyId) ?? "Top property";
      insights.push({
        kind: "portfolio_outlier",
        category: "portfolio",
        severity: "info",
        title: `${name} is generating ${(best._count._all / avg).toFixed(1)}x your portfolio average`,
        body: `${name} captured ${best._count._all} leads over the last 28 days vs. a portfolio average of ${avg.toFixed(1)} per property. Whatever's working there — listings, pricing, ads, SEO — is worth replicating across the rest of your portfolio.`,
        suggestedAction:
          "Audit the top performer's listing photos, pricing, ad spend, and tour booking flow. Then port the playbook to your underperformers.",
        propertyId: best.propertyId,
        entityType: "property",
        entityId: best.propertyId,
        href: `/portal/properties/${best.propertyId}`,
        dedupeKey: `portfolio_outlier_best:${best.propertyId}:week:${weekKey}`,
        context: {
          propertyId: best.propertyId,
          propertyName: name,
          leadsLast28d: best._count._all,
          portfolioAvg: Math.round(avg * 10) / 10,
          multiplier: Math.round((best._count._all / avg) * 10) / 10,
          direction: "best",
        },
      });
    }

    if (worst._count._all <= avg * 0.5 && worst._count._all < avg) {
      const name = propertyMap.get(worst.propertyId) ?? "Bottom property";
      insights.push({
        kind: "portfolio_outlier",
        category: "portfolio",
        severity: "warning",
        title: `${name} is underperforming the portfolio by ${Math.round(((avg - worst._count._all) / avg) * 100)}%`,
        body: `${name} captured ${worst._count._all} leads over the last 28 days vs. a portfolio average of ${avg.toFixed(1)} per property. Either the property is fundamentally less in-demand, the listings are stale, or the marketing mix needs a refresh.`,
        suggestedAction:
          "Compare this property's listing photos, pricing, and ad spend against your top performer. Audit the SEO + reputation page to surface specific gaps.",
        propertyId: worst.propertyId,
        entityType: "property",
        entityId: worst.propertyId,
        href: `/portal/properties/${worst.propertyId}`,
        dedupeKey: `portfolio_outlier_worst:${worst.propertyId}:week:${weekKey}`,
        context: {
          propertyId: worst.propertyId,
          propertyName: name,
          leadsLast28d: worst._count._all,
          portfolioAvg: Math.round(avg * 10) / 10,
          gapPct: Math.round(((avg - worst._count._all) / avg) * 100),
          direction: "worst",
        },
      });
    }

    return insights;
  },
};
