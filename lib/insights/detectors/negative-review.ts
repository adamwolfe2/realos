import "server-only";
import { prisma } from "@/lib/db";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;
// Norman 2026-06-04: staleness windows. Operators don't want to be
// nudged to respond to ancient content — engaging with a 4-year-old
// review or an 8-year-old Reddit thread looks weird and revives dead
// SEO surface area. Reviews stay actionable for 2 years; long-form
// forum threads (Reddit, Facebook public posts, generic web articles)
// stay actionable for 3 years. Anything older is filtered out before
// the detector returns it.
const REVIEW_STALE_MS = 2 * 365 * DAY;
const FORUM_STALE_MS = 3 * 365 * DAY;

function isReviewSource(source: string): boolean {
  return source === "GOOGLE_REVIEW" || source === "YELP";
}

/**
 * Negative review detector.
 *
 * Fires once per (property, mention) when the Reputation scanner classifies
 * a NEW mention as NEGATIVE within the last 24 hours. dedupeKey is the
 * mention id — once the operator marks it acted/dismissed it stays
 * resolved.
 *
 * Severity:
 *   - critical when the mention is on Google (reviewers see it instantly)
 *     or rating is ≤ 2.
 *   - warning otherwise.
 *
 * Staleness filter (Norman 2026-06-04): even if we just ingested a
 * mention, we drop it if `publishedAt` is older than the per-source
 * staleness window. The bug report case was a Reddit thread published
 * 8 years ago being surfaced as "new" because our scanner first saw it
 * 4 days ago. The actionability is zero; the noise is high.
 */
export const negativeReviewDetector: Detector = {
  name: "negative-review",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const since = new Date(Date.now() - DAY);
    const mentions = await prisma.propertyMention.findMany({
      where: {
        orgId,
        sentiment: "NEGATIVE",
        // Use createdAt (when we ingested it) rather than publishedAt so a
        // mention that was published months ago but only just discovered
        // by our scanner still flags fresh.
        createdAt: { gte: since },
      },
      select: {
        id: true,
        source: true,
        title: true,
        excerpt: true,
        rating: true,
        sourceUrl: true,
        publishedAt: true,
        propertyId: true,
        property: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Apply the per-source staleness filter after the DB read so the
    // detector remains explicit and easy to audit. `publishedAt` is
    // nullable — when missing, we keep the row (better to over-surface
    // a recent ingest than silently swallow it).
    const now = Date.now();
    const fresh = mentions.filter((m) => {
      if (m.publishedAt == null) return true;
      const ageMs = now - m.publishedAt.getTime();
      const limit = isReviewSource(m.source)
        ? REVIEW_STALE_MS
        : FORUM_STALE_MS;
      return ageMs <= limit;
    });

    return fresh.map((m): DetectedInsight => {
      const sourceLabel = humanizeSource(m.source);
      const isHighStakes =
        m.source === "GOOGLE_REVIEW" ||
        m.source === "YELP" ||
        (m.rating != null && m.rating <= 2);
      const titlePrefix = m.title?.trim()
        ? `"${m.title.trim().slice(0, 60)}"`
        : `${sourceLabel} review`;
      return {
        kind: "negative_review",
        category: "reputation",
        severity: isHighStakes ? "critical" : "warning",
        title: `New negative ${sourceLabel} review at ${m.property.name}`,
        body: `${titlePrefix}${m.rating != null ? ` · ${m.rating.toFixed(1)}★` : ""}. Excerpt: "${m.excerpt.slice(0, 180)}${m.excerpt.length > 180 ? "…" : ""}"`,
        suggestedAction:
          "Open the mention to draft a reply. Operators who respond within 24 hours see significantly higher recovery rates from negative reviews.",
        propertyId: m.propertyId,
        entityType: null,
        href: `/portal/reputation?mention=${m.id}`,
        dedupeKey: `negative_review:${m.id}`,
        context: {
          mentionId: m.id,
          source: m.source,
          rating: m.rating,
          sourceUrl: m.sourceUrl,
        },
      };
    });
  },
};

function humanizeSource(source: string): string {
  switch (source) {
    case "GOOGLE_REVIEW":
      return "Google";
    case "YELP":
      return "Yelp";
    case "REDDIT":
      return "Reddit";
    case "FACEBOOK_PUBLIC":
      return "Facebook";
    case "TAVILY_WEB":
      return "web";
    default:
      return source.toLowerCase().replace(/_/g, " ");
  }
}
