import "server-only";
import { prisma } from "@/lib/db";
import { LeadSource } from "@prisma/client";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const MIN_ORGANIC_LEADS_PRIOR = 3;

/**
 * SEO ↔ leads disconnect.
 *
 * Cross-source: detects when organic / search leads have collapsed in
 * the last 7 days vs the prior 14-day baseline. Requires SeoIntegration
 * connected (GA4 or GSC) so we only fire for orgs that should be
 * generating organic leads.
 *
 * The signal: SEO is the slowest-moving channel; sudden drops are usually
 * a Google algo update, content gone stale, or a tracking break — all
 * worth diagnosing immediately. Weekly dedupeKey for fresh nudges.
 */
export const seoLeadsDisconnectDetector: Detector = {
  name: "seo-leads-disconnect",
  async run(orgId: string): Promise<DetectedInsight[]> {
    // Only fire when the org has SEO connected. Detector is a no-op for
    // orgs that haven't set up GA4 / GSC yet — they get a different
    // empty-state nudge from the Connect Hub.
    const seoCount = await prisma.seoIntegration.count({ where: { orgId } });
    if (seoCount === 0) return [];

    const now = Date.now();
    const since7d = new Date(now - 7 * DAY);
    const since21d = new Date(now - 21 * DAY);
    const weekKey = isoWeekKey(new Date());

    // Organic + search-engine-attributed leads in both windows.
    const organicSources: LeadSource[] = [LeadSource.ORGANIC];

    const [curr, prior] = await Promise.all([
      prisma.lead.count({
        where: {
          orgId,
          source: { in: organicSources },
          createdAt: { gte: since7d },
        },
      }),
      prisma.lead.count({
        where: {
          orgId,
          source: { in: organicSources },
          createdAt: { gte: since21d, lt: since7d },
        },
      }),
    ]);

    // Need a meaningful prior baseline (avg ≥1.5 leads/wk for 2 weeks).
    if (prior < MIN_ORGANIC_LEADS_PRIOR) return [];

    const priorWeekly = prior / 2;
    if (curr >= priorWeekly * 0.5) return []; // <50% drop = no signal

    const dropPct = Math.round(
      ((priorWeekly - curr) / priorWeekly) * 100,
    );

    return [
      {
        kind: "conv_rate_drop",
        category: "seo",
        severity: dropPct >= 80 ? "critical" : "warning",
        title: `Organic leads collapsed ${dropPct}% week-over-week`,
        body: `Last 7 days: ${curr} organic leads. Prior 14-day weekly average: ${priorWeekly.toFixed(1)}. SEO is your slowest-moving channel; a drop this sharp is usually a Google algo update, indexing issue, or a tracking break — not a content issue.`,
        suggestedAction:
          "Open Google Search Console and check Core Updates + Coverage in the last 14 days. Verify your sitemap is current and that critical pages still return 200. If clicks are flat but leads dropped, your form or tracking broke — not your rankings.",
        propertyId: null,
        entityType: null,
        href: "/portal/seo",
        dedupeKey: `seo_leads_disconnect:org:week:${weekKey}`,
        context: {
          currentLeads: curr,
          priorWeeklyAvg: Math.round(priorWeekly * 10) / 10,
          dropPct,
        },
      },
    ];
  },
};
