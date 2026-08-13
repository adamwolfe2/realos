import "server-only";
import { prisma } from "@/lib/db";
import type { Detector, DetectedInsight } from "../types";
import { isoWeekKey } from "../iso-week";

const DAY = 24 * 60 * 60 * 1000;
// Spike rule (2026-08-14, goal spec slice 10 — severity by rule, never
// LLM judgment): ≥3 negative mentions in the last 7 days AND at least
// double the prior 7 days. The per-mention negative-review detector
// covers individual items; this fires on the PATTERN, once per
// (property, ISO week).
const SPIKE_MIN = 3;

export const negativeMentionSpikeDetector: Detector = {
  name: "negative-mention-spike",
  async run(orgId: string, propertyIds: string[]): Promise<DetectedInsight[]> {
    if (propertyIds.length === 0) return [];
    const now = Date.now();
    const last7 = new Date(now - 7 * DAY);
    const prior7 = new Date(now - 14 * DAY);

    const rows = await prisma.propertyMention.findMany({
      where: {
        orgId,
        propertyId: { in: propertyIds },
        sentiment: "NEGATIVE",
        createdAt: { gte: prior7 },
      },
      select: {
        propertyId: true,
        createdAt: true,
        publishedAt: true,
        source: true,
        property: { select: { name: true } },
      },
    });

    // Staleness filter — mirrors negative-review.ts (Norman 2026-06-04):
    // a first scan ingests YEARS of mentions in one batch, which would
    // read as a fake one-week spike. Reviews stay actionable 2y, forum
    // threads 3y; unknown publishedAt is kept (recent ingest, honest).
    const REVIEW_STALE_MS = 2 * 365 * DAY;
    const FORUM_STALE_MS = 3 * 365 * DAY;
    const mentions = rows.filter((m) => {
      if (m.publishedAt == null) return true;
      const age = now - m.publishedAt.getTime();
      const limit =
        m.source === "GOOGLE_REVIEW" || m.source === "YELP"
          ? REVIEW_STALE_MS
          : FORUM_STALE_MS;
      return age <= limit;
    });

    const byProperty = new Map<
      string,
      { name: string; recent: number; prior: number }
    >();
    for (const m of mentions) {
      const entry = byProperty.get(m.propertyId) ?? {
        name: m.property.name,
        recent: 0,
        prior: 0,
      };
      // Window on when the mention was PUBLISHED (fall back to ingest
      // time) — a first scan back-filling months of history must land
      // each mention in its real week, not read as a one-week spike.
      const at = m.publishedAt ?? m.createdAt;
      if (at < prior7) continue;
      if (at >= last7) entry.recent += 1;
      else entry.prior += 1;
      byProperty.set(m.propertyId, entry);
    }

    const week = isoWeekKey(new Date());
    const out: DetectedInsight[] = [];
    for (const [propertyId, e] of byProperty) {
      if (e.recent < SPIKE_MIN) continue;
      if (e.recent < e.prior * 2) continue;
      out.push({
        kind: "negative_mention_spike",
        category: "reputation",
        severity: e.recent >= SPIKE_MIN * 2 ? "critical" : "warning",
        title: `Negative-mention spike at ${e.name}`,
        body: `${e.recent} negative public mentions in the last 7 days (vs ${e.prior} the week before). AI engines fold fresh sentiment into their answers fast — this is the window to respond.`,
        suggestedAction:
          "Open the reputation feed, respond to the review-platform mentions first, and flag anything factually wrong for a takedown request.",
        propertyId,
        entityType: "property",
        entityId: propertyId,
        href: "/portal/conversations/reputation",
        dedupeKey: `negative_mention_spike:${propertyId}:week:${week}`,
        context: { recent: e.recent, prior: e.prior },
      });
    }
    return out;
  },
};
