import "server-only";
import { prisma } from "@/lib/db";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const HIGH_INTENT_THRESHOLD = 70;
const MIN_HIGH_INTENT_VISITORS = 5;

/**
 * Pixel ↔ leads conversion gap.
 *
 * Cross-source detector: pulls high-intent visitors (intentScore ≥70) from
 * the Cursive pixel feed and checks how many converted to leads in the
 * same window. When ≥5 high-intent visitors hit the site in 7 days but
 * fewer than 30% became leads, that's a CTA / form / chat-availability
 * problem and worth surfacing.
 *
 * The lift is high because:
 *   - High-intent visitors are RESOLVED (we have their email).
 *   - They're already on the site, so the gap isn't traffic — it's
 *     conversion friction.
 *   - The fix is usually concrete: clearer CTA, better form, chatbot
 *     prompt, retargeting campaign.
 */
export const pixelLeadsGapDetector: Detector = {
  name: "pixel-leads-gap",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const since = new Date(Date.now() - 7 * DAY);
    const weekKey = isoWeekKey(new Date());

    // Group visitors by property so we can fire one insight per
    // affected property. NULL-property visitors get their own
    // "portfolio-wide" bucket.
    const visitors = await prisma.visitor.findMany({
      where: {
        orgId,
        intentScore: { gte: HIGH_INTENT_THRESHOLD },
        lastSeenAt: { gte: since },
      },
      select: {
        id: true,
        propertyId: true,
        convertedAt: true,
      },
    });

    if (visitors.length < MIN_HIGH_INTENT_VISITORS) return [];

    // Bucket per property.
    const buckets = new Map<
      string,
      { propertyId: string | null; total: number; converted: number }
    >();

    for (const v of visitors) {
      const key = v.propertyId ?? "_org";
      const existing = buckets.get(key);
      if (existing) {
        existing.total += 1;
        if (v.convertedAt) existing.converted += 1;
      } else {
        buckets.set(key, {
          propertyId: v.propertyId,
          total: 1,
          converted: v.convertedAt ? 1 : 0,
        });
      }
    }

    const propertyMap = new Map(
      (
        await prisma.property.findMany({
          where: {
            orgId,
            id: {
              in: Array.from(buckets.values())
                .map((b) => b.propertyId)
                .filter((id): id is string => !!id),
            },
          },
          select: { id: true, name: true },
        })
      ).map((p) => [p.id, p.name]),
    );

    const insights: DetectedInsight[] = [];
    for (const bucket of buckets.values()) {
      if (bucket.total < MIN_HIGH_INTENT_VISITORS) continue;

      const conversionRate = bucket.converted / bucket.total;
      // Only fire when ≥70% of high-intent visitors are LEAKING (not
      // converting). Below that, conversion is healthy enough.
      if (conversionRate >= 0.3) continue;

      const propertyName = bucket.propertyId
        ? (propertyMap.get(bucket.propertyId) ?? "this property")
        : "your portfolio";
      const leakedCount = bucket.total - bucket.converted;

      insights.push({
        kind: "conv_rate_drop",
        category: "leads",
        severity: bucket.total >= 20 ? "warning" : "info",
        title: `${leakedCount} high-intent visitors at ${propertyName} didn't convert this week`,
        body: `${bucket.total} identified visitors with intent score ≥${HIGH_INTENT_THRESHOLD} hit the site in the last 7 days, but only ${bucket.converted} became leads (${Math.round(conversionRate * 100)}%). Typical conversion at this intent band is 30–60% — your lead capture is leaking.`,
        suggestedAction:
          "Audit your hero CTA placement, tour-booking form length, and chatbot prompt timing. The visitors are already qualified — the friction is somewhere between the page and the form.",
        propertyId: bucket.propertyId,
        entityType: bucket.propertyId ? "property" : null,
        entityId: bucket.propertyId,
        href: bucket.propertyId
          ? `/portal/visitors?propertyId=${bucket.propertyId}`
          : "/portal/visitors",
        dedupeKey: `pixel_leads_gap:${bucket.propertyId ?? "org"}:week:${weekKey}`,
        context: {
          propertyId: bucket.propertyId,
          propertyName: propertyName,
          highIntentCount: bucket.total,
          convertedCount: bucket.converted,
          leakedCount,
          conversionRatePct: Math.round(conversionRate * 100),
          intentThreshold: HIGH_INTENT_THRESHOLD,
        },
      });
    }

    return insights;
  },
};
