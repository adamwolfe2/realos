import "server-only";
import { prisma } from "@/lib/db";
import { LeadSource } from "@prisma/client";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const MIN_SPEND_CENTS = 50_000; // $500 — avoid noise from small-budget tests

// Map AdAccount.platform to the LeadSources we credit it with.
const SOURCE_BY_PLATFORM: Record<string, LeadSource[]> = {
  GOOGLE_ADS: [LeadSource.GOOGLE_ADS],
  META_ADS: [LeadSource.META_ADS],
};

/**
 * Cost-per-lead spike detector.
 *
 * Per platform (Google / Meta), compare last-7d CPL against prior-7d. Fires
 * warning at +30%, critical at +60%. Ignores platforms with <$500 spend in
 * either window so small-budget noise doesn't create alerts.
 */
export const cplSpikeDetector: Detector = {
  name: "cpl-spike",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const now = Date.now();
    const since7d = new Date(now - 7 * DAY);
    const since14d = new Date(now - 14 * DAY);
    const insights: DetectedInsight[] = [];
    const weekKey = isoWeekKey(new Date());

    // Pull 14d of spend aggregated per platform via AdAccount->AdCampaign
    // chain. Keep the query narrow — we only need platform + spend buckets.
    const accounts = await prisma.adAccount.findMany({
      where: { orgId },
      select: { id: true, platform: true },
    });

    for (const acct of accounts) {
      const [currSpend, prevSpend] = await Promise.all([
        prisma.adMetricDaily.aggregate({
          where: { adAccountId: acct.id, date: { gte: since7d } },
          _sum: { spendCents: true },
        }),
        prisma.adMetricDaily.aggregate({
          where: { adAccountId: acct.id, date: { gte: since14d, lt: since7d } },
          _sum: { spendCents: true },
        }),
      ]);

      const currSpendC = currSpend._sum.spendCents ?? 0;
      const prevSpendC = prevSpend._sum.spendCents ?? 0;

      if (currSpendC < MIN_SPEND_CENTS || prevSpendC < MIN_SPEND_CENTS) continue;

      // Count leads that credit this platform in both windows.
      const sources = SOURCE_BY_PLATFORM[acct.platform] ?? [];
      if (sources.length === 0) continue;

      const [currLeads, prevLeads] = await Promise.all([
        prisma.lead.count({
          where: { orgId, source: { in: sources }, createdAt: { gte: since7d } },
        }),
        prisma.lead.count({
          where: {
            orgId,
            source: { in: sources },
            createdAt: { gte: since14d, lt: since7d },
          },
        }),
      ]);

      if (currLeads === 0 || prevLeads === 0) continue;

      const currCpl = currSpendC / currLeads / 100;
      const prevCpl = prevSpendC / prevLeads / 100;
      const deltaPct = ((currCpl - prevCpl) / prevCpl) * 100;

      if (deltaPct < 30) continue;

      const severity: "warning" | "critical" = deltaPct >= 60 ? "critical" : "warning";
      const label = acct.platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads";

      insights.push({
        kind: "cpl_spike",
        category: "ads",
        severity,
        title: `${label} cost per lead jumped ${Math.round(deltaPct)}% this week`,
        body: `This week: $${currCpl.toFixed(2)} per lead on $${(currSpendC / 100).toLocaleString()} spend (${currLeads} leads). Prior week was $${prevCpl.toFixed(2)} per lead (${prevLeads} leads).`,
        suggestedAction:
          "Open Campaigns to check which ad sets changed. Common causes: a campaign exhausted its audience, creative fatigue, or a new competitor bidding up your terms.",
        entityType: "campaign",
        href: "/portal/campaigns",
        dedupeKey: `cpl_spike:${acct.platform}:week:${weekKey}`,
        context: {
          platform: acct.platform,
          currentCpl: Math.round(currCpl * 100) / 100,
          previousCpl: Math.round(prevCpl * 100) / 100,
          deltaPct: Math.round(deltaPct * 10) / 10,
          currentSpendUsd: Math.round(currSpendC / 100),
          previousSpendUsd: Math.round(prevSpendC / 100),
          currentLeads: currLeads,
          previousLeads: prevLeads,
        },
      });
    }

    return insights;
  },
};
