import "server-only";
import { prisma } from "@/lib/db";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";
import { propertyIdsToWhere } from "@/lib/tenancy/property-filter";
import { fatigue, FATIGUE_DROP } from "@/lib/integrations/ads-insights-math";
import { realAdAccountWhere } from "@/lib/integrations/real-ad-account";

const DAY = 86_400_000;
const WINDOW_DAYS = 28;
const INACTIVE = /PAUSED|DISABLED|ARCHIVED|DELETED|REMOVED/i;

/**
 * Creative fatigue, per ad.
 *
 * Click rate in the last 7 days vs the first 7 days of the last 28. A drop
 * of 30%+ on 1,000+ impressions at each end usually means the audience has
 * seen the ad too often. Keyed per ad per week. Recommends a refresh;
 * never edits the ad.
 */
export const creativeFatigueDetector: Detector = {
  name: "creative-fatigue",
  async run(orgId: string, propertyIds: string[]): Promise<DetectedInsight[]> {
    const since = new Date(Date.now() - WINDOW_DAYS * DAY);
    const realAccount = await realAdAccountWhere(orgId);
    const creatives = await prisma.adCreative.findMany({
      where: {
        orgId,
        adAccount: realAccount,
        OR: [{ campaign: propertyIdsToWhere(propertyIds) }, { campaign: { propertyId: null } }],
      },
      select: {
        id: true,
        name: true,
        headline: true,
        status: true,
        platform: true,
        campaign: { select: { id: true, name: true, propertyId: true } },
      },
    });
    const active = creatives.filter((c) => !INACTIVE.test(c.status ?? ""));
    if (active.length === 0) return [];

    const rows = await prisma.adCreativeMetricDaily.findMany({
      where: {
        orgId, // property-scope: org-level — creative ids above are already limited to enabled properties
        adCreativeId: { in: active.map((c) => c.id) },
        date: { gte: since },
      },
      select: { adCreativeId: true, date: true, impressions: true, clicks: true },
    });
    const byCreative = new Map<string, typeof rows>();
    for (const r of rows) byCreative.set(r.adCreativeId, [...(byCreative.get(r.adCreativeId) ?? []), r]);

    const week = isoWeekKey(new Date());
    const insights: DetectedInsight[] = [];
    for (const c of active) {
      const f = fatigue(byCreative.get(c.id) ?? []);
      if (!f || f.drop < FATIGUE_DROP) continue;
      const pct = Math.round(f.drop * 100);
      const label = c.headline ?? c.name;
      const platform = c.platform === "GOOGLE_ADS" ? "Google" : "Meta";
      insights.push({
        kind: "creative_fatigue",
        category: "ads",
        severity: pct >= 50 ? "warning" : "info",
        title: `"${label}" is wearing out: click rate down ${pct}%`,
        body: `This ${platform} ad's click rate fell from ${(f.earlyCtr * 100).toFixed(2)}% to ${(f.lateCtr * 100).toFixed(2)}% over the last ${WINDOW_DAYS} days${c.campaign ? ` in "${c.campaign.name}"` : ""}. People have likely seen it too many times.`,
        suggestedAction: "Swap in a new photo or headline and keep the offer the same, so the change in results is down to the creative.",
        propertyId: c.campaign?.propertyId ?? null,
        entityType: "campaign",
        entityId: c.campaign?.id ?? null,
        href: c.campaign ? `/portal/ads/campaigns/${c.campaign.id}` : "/portal/ads",
        dedupeKey: `creative_fatigue:${c.id}:week:${week}`,
        context: { creativeId: c.id, dropPct: pct, earlyCtr: f.earlyCtr, lateCtr: f.lateCtr, actionLabel: "See the campaign →" },
      });
    }
    return insights;
  },
};
