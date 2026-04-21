import "server-only";
import { prisma } from "@/lib/db";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

// Leasing velocity drop detector.
//
// Compares lead + tour + application volume over the last 4 weeks vs the
// prior 4 weeks. Student housing is a sprint — by the time you notice you're
// behind, the leasing window is half over. This fires early so operators can
// adjust before they're forced to drop rates.
//
// Thresholds (combined score = leads + 2×tours + 3×apps, weighted by funnel depth):
//   warning:  -20% combined score vs prior 4w
//   critical: -40% combined score vs prior 4w
export const leasingVelocityDropDetector: Detector = {
  name: "leasing-velocity-drop",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const now = Date.now();
    const since4w = new Date(now - 4 * WEEK);
    const since8w = new Date(now - 8 * WEEK);

    const [
      currLeads,
      prevLeads,
      currTours,
      prevTours,
      currApps,
      prevApps,
    ] = await Promise.all([
      prisma.lead.count({ where: { orgId, createdAt: { gte: since4w } } }),
      prisma.lead.count({ where: { orgId, createdAt: { gte: since8w, lt: since4w } } }),
      prisma.tour.count({ where: { lead: { orgId }, createdAt: { gte: since4w } } }),
      prisma.tour.count({ where: { lead: { orgId }, createdAt: { gte: since8w, lt: since4w } } }),
      prisma.application.count({ where: { lead: { orgId }, createdAt: { gte: since4w } } }),
      prisma.application.count({ where: { lead: { orgId }, createdAt: { gte: since8w, lt: since4w } } }),
    ]);

    if (prevLeads < 5) return [];

    // Weighted score: applications are worth 3x (deepest funnel signal),
    // tours 2x, leads 1x.
    const currScore = currLeads + 2 * currTours + 3 * currApps;
    const prevScore = prevLeads + 2 * prevTours + 3 * prevApps;

    if (prevScore === 0) return [];

    const dropPct = Math.round(((prevScore - currScore) / prevScore) * 100);

    if (dropPct < 20) return [];

    const severity: "warning" | "critical" = dropPct >= 40 ? "critical" : "warning";
    const weekKey = isoWeekKey(new Date());

    return [
      {
        kind: "leasing_velocity_drop",
        category: "leads",
        severity,
        title: `Leasing velocity down ${dropPct}% vs prior 4 weeks`,
        body: `Last 4 weeks: ${currLeads} leads, ${currTours} tours, ${currApps} applications. Prior 4 weeks: ${prevLeads} leads, ${prevTours} tours, ${prevApps} applications. Combined activity score dropped ${dropPct}%.`,
        suggestedAction:
          dropPct >= 40
            ? "Critical drop in leasing momentum. Review marketing spend mix, check if the chatbot is capturing leads, and verify your listing SEO is indexed correctly."
            : "Early warning: leasing activity is trending down. Check if tour bookings are being confirmed and follow up on any stalled leads before the pipeline dries up.",
        href: "/portal/leads",
        dedupeKey: `leasing_velocity_drop:org:${weekKey}`,
        context: {
          dropPct,
          currLeads,
          currTours,
          currApps,
          prevLeads,
          prevTours,
          prevApps,
          currScore,
          prevScore,
        },
      },
    ];
  },
};
