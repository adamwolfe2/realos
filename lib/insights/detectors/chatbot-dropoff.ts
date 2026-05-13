import "server-only";
import { prisma } from "@/lib/db";
import { isoWeekKey } from "../iso-week";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const MIN_CONVERSATIONS = 10;
const MIN_DROPOFF_PCT = 0.6; // ≥60% of conversations end without lead capture

/**
 * Chatbot drop-off detector.
 *
 * Flags when the chatbot is having lots of conversations but failing to
 * capture leads. The pattern: visitors engage, the bot can't answer the
 * specific question (pricing, availability, pet policy, lease length),
 * and they abandon without giving an email.
 *
 * The fix is concrete — extend the chatbot knowledge base with the
 * frequently-missed topic. We can't auto-detect WHAT topic is missing
 * yet (that's a future sentiment-classification detector) but flagging
 * the gap is the first useful signal.
 */
export const chatbotDropoffDetector: Detector = {
  name: "chatbot-dropoff",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const since = new Date(Date.now() - 7 * DAY);
    const weekKey = isoWeekKey(new Date());

    const conversations = await prisma.chatbotConversation.findMany({
      where: {
        orgId,
        createdAt: { gte: since },
      },
      select: {
        id: true,
        propertyId: true,
        capturedEmail: true,
        capturedPhone: true,
        leadId: true,
        messageCount: true,
      },
    });

    if (conversations.length < MIN_CONVERSATIONS) return [];

    // Bucket per property; capture the dropoff for each.
    const buckets = new Map<
      string,
      {
        propertyId: string | null;
        total: number;
        captured: number;
        engaged: number; // ≥3 messages = visitor actually used the bot
      }
    >();

    for (const c of conversations) {
      const key = c.propertyId ?? "_org";
      const captured =
        !!c.capturedEmail || !!c.capturedPhone || !!c.leadId;
      const engaged = (c.messageCount ?? 0) >= 3;
      const existing = buckets.get(key);
      if (existing) {
        existing.total += 1;
        if (captured) existing.captured += 1;
        if (engaged) existing.engaged += 1;
      } else {
        buckets.set(key, {
          propertyId: c.propertyId,
          total: 1,
          captured: captured ? 1 : 0,
          engaged: engaged ? 1 : 0,
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
      if (bucket.total < MIN_CONVERSATIONS) continue;
      // Only fire when the visitor ENGAGED (≥3 messages) — drop-off
      // on 1-message conversations is noise, not a chatbot problem.
      if (bucket.engaged < MIN_CONVERSATIONS) continue;

      const dropoffRate = 1 - bucket.captured / bucket.engaged;
      if (dropoffRate < MIN_DROPOFF_PCT) continue;

      const propertyName = bucket.propertyId
        ? (propertyMap.get(bucket.propertyId) ?? "this property")
        : "your portfolio";
      const droppedCount = bucket.engaged - bucket.captured;

      insights.push({
        kind: "chatbot_pattern",
        category: "chatbot",
        severity: "warning",
        title: `Chatbot at ${propertyName} is losing ${droppedCount} engaged visitors per week`,
        body: `${bucket.engaged} visitors engaged with the chatbot (≥3 messages) but only ${bucket.captured} gave their email or phone — a ${Math.round(dropoffRate * 100)}% drop-off. The bot is starting conversations it can't finish.`,
        suggestedAction:
          "Open recent transcripts and look for the question the bot fumbled. Most common gaps: real-time pricing, current availability, pet policy specifics, lease length flexibility. Add the answer to the chatbot knowledge base in Configure.",
        propertyId: bucket.propertyId,
        entityType: bucket.propertyId ? "property" : null,
        entityId: bucket.propertyId,
        href: "/portal/conversations",
        dedupeKey: `chatbot_dropoff:${bucket.propertyId ?? "org"}:week:${weekKey}`,
        context: {
          propertyId: bucket.propertyId,
          propertyName,
          totalConversations: bucket.total,
          engagedCount: bucket.engaged,
          capturedCount: bucket.captured,
          droppedCount,
          dropoffPct: Math.round(dropoffRate * 100),
        },
      });
    }

    return insights;
  },
};
