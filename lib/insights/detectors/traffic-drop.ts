import "server-only";
import { prisma } from "@/lib/db";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Traffic drop detector.
 *
 * Compares last-7d organic sessions (from SeoSnapshot) against the prior 7d
 * window. Fires warning at >=20% drop, critical at >=40% drop. Keyed on
 * week so it only fires once per week per org. Requires a minimum sample
 * (30 sessions in the prior window) to avoid noisy alerts for new sites.
 */
export const trafficDropDetector: Detector = {
  name: "traffic-drop",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const now = Date.now();
    const since7d = new Date(now - 7 * DAY);
    const since14d = new Date(now - 14 * DAY);

    const [current, previous] = await Promise.all([
      prisma.seoSnapshot.aggregate({
        where: { orgId, date: { gte: since7d } },
        _sum: { organicSessions: true, totalClicks: true },
      }),
      prisma.seoSnapshot.aggregate({
        where: { orgId, date: { gte: since14d, lt: since7d } },
        _sum: { organicSessions: true, totalClicks: true },
      }),
    ]);

    const currSessions = current._sum.organicSessions ?? 0;
    const prevSessions = previous._sum.organicSessions ?? 0;

    if (prevSessions < 30) return [];

    const deltaPct = ((currSessions - prevSessions) / prevSessions) * 100;
    if (deltaPct > -20) return [];

    const severity: "warning" | "critical" = deltaPct <= -40 ? "critical" : "warning";
    const absDrop = prevSessions - currSessions;
    const weekKey = isoWeekKey(new Date());

    return [
      {
        kind: "traffic_drop",
        category: "traffic",
        severity,
        title: `Organic traffic down ${Math.abs(Math.round(deltaPct))}% week-over-week`,
        body: `Last 7 days brought ${currSessions.toLocaleString()} organic sessions, down ${absDrop.toLocaleString()} from the ${prevSessions.toLocaleString()} the prior week. Combined across Google Search Console and GA4.`,
        suggestedAction:
          "Open SEO to see which queries and landing pages lost visibility. Common causes: an algorithm update, a slow week, or a page falling out of index.",
        href: "/portal/seo",
        dedupeKey: `traffic_drop:org:${weekKey}`,
        context: {
          currentSessions: currSessions,
          previousSessions: prevSessions,
          deltaPct: Math.round(deltaPct * 10) / 10,
          periodDays: 7,
        },
      },
    ];
  },
};
