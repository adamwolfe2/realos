import "server-only";
import { prisma } from "@/lib/db";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const MIN_SPEND_CENTS = 50_000; // $500 minimum to flag

/**
 * Audience exhaustion detector.
 *
 * Per ad campaign: when 7-day spend is on par with the prior 7 days
 * BUT impressions per dollar dropped ≥30% AND clicks per dollar
 * dropped too — that's classic audience-exhaustion. The targeting
 * group is saturated; the same eyeballs are seeing the same creative
 * for the Nth time and the auction is competing harder for the
 * remaining unfatigued users.
 *
 * The fix is one of: (a) refresh the creative (b) widen the audience
 * (c) introduce a lookalike (d) pause and run a different angle.
 */
export const audienceExhaustionDetector: Detector = {
  name: "audience-exhaustion",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const now = Date.now();
    const since7d = new Date(now - 7 * DAY);
    const since14d = new Date(now - 14 * DAY);
    const weekKey = isoWeekKey(new Date());

    const campaigns = await prisma.adCampaign.findMany({
      where: {
        orgId,
        status: { not: "PAUSED" },
      },
      select: {
        id: true,
        name: true,
        platform: true,
        propertyId: true,
      },
    });

    if (campaigns.length === 0) return [];

    // Pull spend, impressions, clicks per campaign in both windows.
    const [currMetrics, priorMetrics] = await Promise.all([
      prisma.adMetricDaily.groupBy({
        by: ["campaignId"],
        where: {
          campaignId: { in: campaigns.map((c) => c.id) },
          date: { gte: since7d },
        },
        _sum: {
          spendCents: true,
          impressions: true,
          clicks: true,
        },
      }),
      prisma.adMetricDaily.groupBy({
        by: ["campaignId"],
        where: {
          campaignId: { in: campaigns.map((c) => c.id) },
          date: { gte: since14d, lt: since7d },
        },
        _sum: {
          spendCents: true,
          impressions: true,
          clicks: true,
        },
      }),
    ]);

    const currByCampaign = new Map(
      currMetrics
        .filter((m) => m.campaignId != null)
        .map((m) => [m.campaignId as string, m._sum]),
    );
    const priorByCampaign = new Map(
      priorMetrics
        .filter((m) => m.campaignId != null)
        .map((m) => [m.campaignId as string, m._sum]),
    );

    const insights: DetectedInsight[] = [];
    for (const campaign of campaigns) {
      const curr = currByCampaign.get(campaign.id);
      const prior = priorByCampaign.get(campaign.id);
      if (!curr || !prior) continue;

      const currSpend = curr.spendCents ?? 0;
      const priorSpend = prior.spendCents ?? 0;
      if (currSpend < MIN_SPEND_CENTS || priorSpend < MIN_SPEND_CENTS) continue;

      const currImpressions = curr.impressions ?? 0;
      const priorImpressions = prior.impressions ?? 0;
      const currClicks = curr.clicks ?? 0;
      const priorClicks = prior.clicks ?? 0;

      if (priorImpressions === 0 || priorClicks === 0) continue;

      // Impressions per dollar.
      const currImpPerDollar = currImpressions / (currSpend / 100);
      const priorImpPerDollar = priorImpressions / (priorSpend / 100);
      const impEfficiencyDrop =
        ((priorImpPerDollar - currImpPerDollar) / priorImpPerDollar) * 100;

      // Clicks per dollar.
      const currClicksPerDollar = currClicks / (currSpend / 100);
      const priorClicksPerDollar = priorClicks / (priorSpend / 100);
      const clickEfficiencyDrop =
        ((priorClicksPerDollar - currClicksPerDollar) /
          priorClicksPerDollar) *
        100;

      // Both must be down ≥30% to fire — single-metric drops are
      // usually statistical noise on small budgets.
      if (impEfficiencyDrop < 30 || clickEfficiencyDrop < 30) continue;

      const platformLabel =
        campaign.platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads";

      insights.push({
        kind: "cpl_spike",
        category: "ads",
        severity: "warning",
        title: `${platformLabel} audience exhaustion on "${campaign.name}"`,
        body: `Spend held steady week-over-week (~$${Math.round(currSpend / 100).toLocaleString()}) but impressions per dollar dropped ${Math.round(impEfficiencyDrop)}% and clicks per dollar dropped ${Math.round(clickEfficiencyDrop)}%. The targeting pool is saturated; you're paying more for the same eyeballs.`,
        suggestedAction:
          "Refresh the creative (new image + headline), widen the audience by 20%, or layer in a lookalike. If none of those move the needle in 7 days, pause and ship a different angle.",
        propertyId: campaign.propertyId,
        entityType: "campaign",
        entityId: campaign.id,
        href: `/portal/campaigns#${campaign.id}`,
        dedupeKey: `audience_exhaustion:${campaign.id}:week:${weekKey}`,
        context: {
          campaignId: campaign.id,
          campaignName: campaign.name,
          platform: campaign.platform,
          currentSpendUsd: Math.round(currSpend / 100),
          impEfficiencyDropPct: Math.round(impEfficiencyDrop),
          clickEfficiencyDropPct: Math.round(clickEfficiencyDrop),
        },
      });
    }

    return insights;
  },
};
