import "server-only";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";
import { fetchDedupedSeoSnapshots, sumField } from "@/lib/seo/snapshot-supersede";
import { propertyIdsToWhere } from "@/lib/tenancy/property-filter";

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
  async run(orgId: string, propertyIds: string[]): Promise<DetectedInsight[]> {
    const now = Date.now();
    const since7d = new Date(now - 7 * DAY);
    const since14d = new Date(now - 14 * DAY);

    // Org-wide read over the full 14d window, then split in JS — one query
    // instead of three, and the supersede dedupe (see
    // lib/seo/snapshot-supersede.ts) guarantees a date's org-wide NULL row
    // and a property-scoped row for that same date never both get summed.
    //
    // SeoSnapshot.propertyId is nullable: NULL rows are a legacy org-wide
    // GA4/GSC connection covering the whole site; non-null rows are scoped
    // to one property. Keep both org-wide rows and rows on properties
    // enabled in LeaseStack; drop snapshots tied to a disabled/excluded
    // property so a customer who once connected GA4 to a building they
    // later turned off doesn't inflate this org's traffic numbers.
    const rows = await fetchDedupedSeoSnapshots({
      orgId,
      date: { gte: since14d },
      OR: [propertyIdsToWhere(propertyIds), { propertyId: null }],
    });
    const daily = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
    const current = rows.filter((r) => r.date >= since7d);
    const previous = rows.filter((r) => r.date < since7d);

    const currSessions = sumField(current, "organicSessions");
    const prevSessions = sumField(previous, "organicSessions");

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
          sparkline: daily.map((d) => d.organicSessions),
        },
      },
    ];
  },
};
