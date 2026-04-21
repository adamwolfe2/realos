import "server-only";
import { prisma } from "@/lib/db";
import { LeadStatus } from "@prisma/client";
import type { Detector, DetectedInsight } from "../types";

const DAY = 24 * 60 * 60 * 1000;

// A lead is "stalled" when lastActivityAt is > STALL_DAYS ago AND the lead
// is in an actionable status (NEW or CONTACTED). TOUR_SCHEDULED and later are
// owned by the next action in the funnel — we don't flag them.
const STALL_DAYS = 5;
const ACTIONABLE_STATUSES: LeadStatus[] = [LeadStatus.NEW, LeadStatus.CONTACTED];

/**
 * Pipeline stall detector.
 *
 * Fires one insight per stalled lead. Dedupe key is the leadId so we never
 * double-fire. When the lead moves out of the actionable statuses or gets
 * fresh activity, the runner auto-resolves the insight.
 */
export const pipelineStallDetector: Detector = {
  name: "pipeline-stall",
  async run(orgId: string): Promise<DetectedInsight[]> {
    const since = new Date(Date.now() - STALL_DAYS * DAY);
    const stalled = await prisma.lead.findMany({
      where: {
        orgId,
        status: { in: ACTIONABLE_STATUSES },
        lastActivityAt: { lt: since },
      },
      orderBy: { lastActivityAt: "asc" },
      take: 25, // cap insights per run so we don't flood
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        source: true,
        lastActivityAt: true,
        propertyId: true,
        score: true,
      },
    });

    return stalled.map((lead) => {
      const daysStalled = Math.floor(
        (Date.now() - lead.lastActivityAt.getTime()) / DAY,
      );
      const name =
        [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() ||
        lead.email ||
        "Unknown lead";
      const severity: "info" | "warning" | "critical" =
        daysStalled >= 14 ? "critical" : daysStalled >= 9 ? "warning" : "info";

      return {
        kind: "pipeline_stall",
        category: "leads",
        severity,
        title: `${name} has been untouched for ${daysStalled} days`,
        body: `Status is ${lead.status.toLowerCase().replace("_", " ")}, source is ${lead.source.toLowerCase()}. Score ${lead.score}. No recorded activity since ${lead.lastActivityAt.toLocaleDateString()}.`,
        suggestedAction:
          "Call or email before they lose interest. Warm leads go cold after the first week.",
        propertyId: lead.propertyId,
        entityType: "lead",
        entityId: lead.id,
        href: `/portal/leads/${lead.id}`,
        dedupeKey: `pipeline_stall:${lead.id}`,
        context: {
          leadId: lead.id,
          daysStalled,
          status: lead.status,
          source: lead.source,
          score: lead.score,
          lastActivityAt: lead.lastActivityAt.toISOString(),
        },
      };
    });
  },
};
