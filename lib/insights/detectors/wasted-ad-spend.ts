import "server-only";
import { prisma } from "@/lib/db";
import { LeadSource } from "@prisma/client";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const MIN_WASTED_SPEND_CENTS = 25_000; // $250 minimum to flag

const SOURCE_BY_PLATFORM: Record<string, LeadSource[]> = {
  GOOGLE_ADS: [LeadSource.GOOGLE_ADS],
  META_ADS: [LeadSource.META_ADS],
};

/**
 * Wasted ad-spend detector.
 *
 * Per campaign over the last 7 days: flags campaigns that spent ≥ $250
 * AND drove zero attributable leads. These are the highest-leverage
 * pause-or-fix candidates for an operator's first dashboard load.
 *
 * dedupeKey is keyed on (campaignId, week) so the insight re-fires next
 * week if the operator never paused the campaign and it's still bleeding.
 */
export const wastedAdSpendDetector: Detector = {
  name: "wasted-ad-spend",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const since = new Date(Date.now() - 7 * DAY);
    const weekKey = isoWeekKey(new Date());

    const campaigns = await prisma.adCampaign.findMany({
      where: {
        orgId,
        // Skip already-paused campaigns — they're not actively wasting
        // budget. Status uppercase varies by platform; trust the platform
        // label rather than normalizing.
        status: { not: "PAUSED" },
      },
      select: {
        id: true,
        name: true,
        platform: true,
        propertyId: true,
        externalCampaignId: true,
      },
    });

    if (campaigns.length === 0) return [];

    // Aggregate spend per campaign over the window.
    const spendRows = await prisma.adMetricDaily.groupBy({
      by: ["campaignId"],
      where: {
        campaignId: { in: campaigns.map((c) => c.id) },
        date: { gte: since },
      },
      _sum: { spendCents: true },
    });
    const spendByCampaign = new Map<string, number>(
      spendRows
        .filter((r) => r.campaignId != null)
        .map((r) => [r.campaignId as string, r._sum?.spendCents ?? 0]),
    );

    const insights: DetectedInsight[] = [];

    for (const campaign of campaigns) {
      const spendCents = spendByCampaign.get(campaign.id) ?? 0;
      if (spendCents < MIN_WASTED_SPEND_CENTS) continue;

      // Count leads attributed to this platform in the window. We don't
      // have campaign-level lead attribution yet, so we approximate at
      // the platform level — if the platform produced ZERO leads while
      // this campaign spent ≥$250, it's a strong waste signal.
      const sources = SOURCE_BY_PLATFORM[campaign.platform] ?? [];
      if (sources.length === 0) continue;

      const leadCount = await prisma.lead.count({
        where: {
          orgId,
          source: { in: sources },
          createdAt: { gte: since },
          ...(campaign.propertyId
            ? { propertyId: campaign.propertyId }
            : {}),
        },
      });
      if (leadCount > 0) continue;

      const dollars = Math.round(spendCents / 100);
      const platformLabel =
        campaign.platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads";

      insights.push({
        kind: "wasted_ad_spend",
        category: "ads",
        severity: dollars >= 1000 ? "critical" : "warning",
        title: `${platformLabel} campaign spent $${dollars.toLocaleString()} with zero leads (7d)`,
        body: `"${campaign.name}" has burned $${dollars.toLocaleString()} this week and produced no attributable leads. Common causes: targeting drift, paused landing page, broken UTM tags, or audience exhaustion.`,
        suggestedAction:
          "Pause the campaign or push a fresh creative. If your conversion tracking is broken, leads may exist but aren't credited — verify the pixel + UTM tags first.",
        propertyId: campaign.propertyId,
        entityType: "campaign",
        entityId: campaign.id,
        href: `/portal/campaigns#${campaign.id}`,
        dedupeKey: `wasted_ad_spend:${campaign.id}:week:${weekKey}`,
        context: {
          campaignId: campaign.id,
          campaignName: campaign.name,
          platform: campaign.platform,
          spendUsd: dollars,
          leads: 0,
        },
      });
    }

    return insights;
  },
};
