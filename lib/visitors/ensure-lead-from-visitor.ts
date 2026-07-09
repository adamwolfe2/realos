import { prisma } from "@/lib/db";
import {
  LeadSource,
  LeadStatus,
  VisitorIdentificationStatus,
  LeadNotifyChannel,
} from "@prisma/client";
import { notifyLeadCaptured } from "@/lib/notifications/lead-notify";

// Minimal shape of the Visitor row this helper needs. Accepting a Pick
// (rather than the full Prisma model) keeps the function unit-testable and
// lets both the outreach cron and the operator "Convert to lead" button
// feed it the same way.
export type VisitorForLead = {
  id: string;
  orgId: string;
  propertyId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  enrichedData: unknown;
};

export type EnsureLeadResult = {
  leadId: string;
  created: boolean;
};

// ---------------------------------------------------------------------------
// ensureLeadFromVisitor
//
// Idempotently promotes a pixel-identified Visitor into a tracked
// PIXEL_OUTREACH Lead. This is the single attribution bridge for the
// segment-sync / outreach path: visitors created by pixel-segment-sync never
// pass through the realtime webhook's lead-minting (which only fires for
// `leadWorthy` webhook events), so without this they stay invisible to the
// funnel + attribution reports.
//
// Guarantees:
//   - No email  → returns null (can't create a trackable lead).
//   - Idempotent: an existing lead for this visitor (by visitorId or by
//     case-insensitive email within the org) is returned, never duplicated.
//   - On create: links Lead.visitorId, sets Visitor.status = MATCHED_TO_LEAD,
//     and fires the operator lead-captured notification exactly once.
//
// The notification + visitor status update are best-effort; a failure there
// must not throw away the lead we just created.
// ---------------------------------------------------------------------------
export async function ensureLeadFromVisitor(
  visitor: VisitorForLead,
): Promise<EnsureLeadResult | null> {
  if (!visitor.email) return null;
  const email = visitor.email.toLowerCase();

  // Idempotency: reuse any lead already tied to this visitor or email.
  const existing = await prisma.lead.findFirst({
    where: {
      orgId: visitor.orgId,
      OR: [
        { visitorId: visitor.id },
        { email: { equals: email, mode: "insensitive" } },
      ],
    },
    select: { id: true, visitorId: true },
  });
  if (existing) {
    // Backfill the visitor link if an email-matched lead predated the pixel
    // identity (e.g. a chatbot lead that later got pixel-resolved).
    if (!existing.visitorId) {
      await prisma.lead
        .update({
          where: { id: existing.id },
          data: { visitorId: visitor.id },
        })
        .catch(() => {});
    }
    return { leadId: existing.id, created: false };
  }

  const enriched =
    visitor.enrichedData && typeof visitor.enrichedData === "object"
      ? (visitor.enrichedData as Record<string, unknown>)
      : null;
  const city =
    typeof enriched?.PERSONAL_CITY === "string" ? enriched.PERSONAL_CITY : null;
  const state =
    typeof enriched?.PERSONAL_STATE === "string"
      ? enriched.PERSONAL_STATE
      : null;
  const referrer =
    typeof enriched?.REFERRER_URL === "string" ? enriched.REFERRER_URL : null;
  const locationLine = [city, state].filter(Boolean).join(", ") || null;

  const lead = await prisma.lead.create({
    data: {
      orgId: visitor.orgId,
      propertyId: visitor.propertyId ?? null,
      visitorId: visitor.id,
      source: LeadSource.PIXEL_OUTREACH,
      sourceDetail: referrer
        ? `Pixel-identified · landed on ${referrer}`
        : "Pixel-identified visitor",
      firstName: visitor.firstName ?? null,
      lastName: visitor.lastName ?? null,
      email,
      phone: visitor.phone ?? null,
      notes:
        [
          "Auto-converted from a pixel-identified visitor after outreach.",
          locationLine ? `Location: ${locationLine}.` : null,
          referrer && referrer !== "$direct"
            ? `Last landing: ${referrer}.`
            : null,
        ]
          .filter(Boolean)
          .join(" ") || "Auto-converted from a pixel-identified visitor.",
      status: LeadStatus.NEW,
    },
  });

  // Best-effort visitor status flip + operator ping — never let these throw
  // away the lead we just persisted.
  await prisma.visitor
    .update({
      where: { id: visitor.id },
      data: {
        status: VisitorIdentificationStatus.MATCHED_TO_LEAD,
        convertedAt: new Date(),
      },
    })
    .catch(() => {});

  void notifyLeadCaptured({
    orgId: visitor.orgId,
    leadId: lead.id,
    propertyId: visitor.propertyId ?? null,
    channel: LeadNotifyChannel.VISITOR_CONVERT,
    lead: {
      name:
        [visitor.firstName, visitor.lastName].filter(Boolean).join(" ") || email,
      email,
      phone: visitor.phone ?? null,
      sourceLabel: "Pixel-identified visitor",
      intent: locationLine,
    },
  }).catch(() => {});

  return { leadId: lead.id, created: true };
}
