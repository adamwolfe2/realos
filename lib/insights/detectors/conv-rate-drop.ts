import "server-only";
import { prisma } from "@/lib/db";
import { LeadStatus } from "@prisma/client";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Conversion rate drop detector.
 *
 * Looks at tour-scheduled rate: of leads created in the window, what
 * percentage made it to TOUR_SCHEDULED or beyond? Compares last 28d to prior
 * 28d. Fires warning at -10pp, critical at -20pp. This is the "your funnel
 * is cracking somewhere" alarm.
 */
export const convRateDropDetector: Detector = {
  name: "conv-rate-drop",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const now = Date.now();
    const since28d = new Date(now - 28 * DAY);
    const since56d = new Date(now - 56 * DAY);

    const tourOrBeyond: LeadStatus[] = [
      LeadStatus.TOUR_SCHEDULED,
      LeadStatus.TOURED,
      LeadStatus.APPLIED,
      LeadStatus.APPROVED,
      LeadStatus.SIGNED,
    ];

    const [currTotal, currConverted, prevTotal, prevConverted] = await Promise.all([
      prisma.lead.count({ where: { orgId, createdAt: { gte: since28d } } }),
      prisma.lead.count({
        where: {
          orgId,
          createdAt: { gte: since28d },
          status: { in: tourOrBeyond },
        },
      }),
      prisma.lead.count({
        where: { orgId, createdAt: { gte: since56d, lt: since28d } },
      }),
      prisma.lead.count({
        where: {
          orgId,
          createdAt: { gte: since56d, lt: since28d },
          status: { in: tourOrBeyond },
        },
      }),
    ]);

    if (prevTotal < 20 || currTotal < 10) return [];

    const currRate = (currConverted / currTotal) * 100;
    const prevRate = (prevConverted / prevTotal) * 100;
    const deltaPp = currRate - prevRate;

    if (deltaPp > -10) return [];

    const severity: "warning" | "critical" = deltaPp <= -20 ? "critical" : "warning";
    const weekKey = isoWeekKey(new Date());

    return [
      {
        kind: "conv_rate_drop",
        category: "leads",
        severity,
        title: `Tour-booking rate fell ${Math.abs(Math.round(deltaPp))} points`,
        body: `Last 28 days: ${currRate.toFixed(1)}% of leads reached a tour (${currConverted} of ${currTotal}). Prior 28 days: ${prevRate.toFixed(1)}% (${prevConverted} of ${prevTotal}).`,
        suggestedAction:
          "Open the Leads funnel to see where drop-off moved. Common causes: lead source mix shifted (more low-intent traffic), slower response time, or tour slots booked out.",
        href: "/portal/leads",
        dedupeKey: `conv_rate_drop:org:${weekKey}`,
        context: {
          currentRatePct: Math.round(currRate * 10) / 10,
          previousRatePct: Math.round(prevRate * 10) / 10,
          deltaPp: Math.round(deltaPp * 10) / 10,
          currentTotal: currTotal,
          currentConverted: currConverted,
          previousTotal: prevTotal,
          previousConverted: prevConverted,
        },
      },
    ];
  },
};
