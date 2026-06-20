import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  LeadNotifyChannel,
  LeadSource,
  LeadStatus,
  TourStatus,
} from "@prisma/client";
import { notifyLeadCaptured } from "@/lib/notifications/lead-notify";

// ---------------------------------------------------------------------------
// Cal.com booking webhook — token + processing.
//
// SECURITY (P0-2): the receiver is authenticated solely by an unguessable
// per-org token in the URL path (the same model as CursiveIntegration). The
// previous design used the org's cuid as the path secret, but that cuid was
// leaked by the public chatbot config endpoint, enabling cross-tenant lead /
// tour injection into ANY tenant. The token below is never returned on any
// public surface — it is only ever shown to the authenticated operator on the
// Integrations page.
// ---------------------------------------------------------------------------

export const CAL_TOKEN_RE = /^[a-f0-9]{32}$/;
const CAL_EXTERNAL_SYSTEM = "cal";

function mintToken(): string {
  return randomBytes(16).toString("hex"); // 32 lowercase hex chars = 128 bits
}

// Lazily mint (once) and return the org's Cal webhook token. Race-safe: the
// conditional updateMany only writes when no token exists yet, so concurrent
// callers converge on the first-written token rather than clobbering it.
export async function getOrCreateCalWebhookToken(
  orgId: string,
): Promise<string> {
  const existing = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { calWebhookToken: true },
  });
  if (existing?.calWebhookToken) return existing.calWebhookToken;

  await prisma.organization.updateMany({
    where: { id: orgId, calWebhookToken: null },
    data: { calWebhookToken: mintToken() },
  });

  const settled = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { calWebhookToken: true },
  });
  if (!settled?.calWebhookToken) {
    throw new Error("Failed to mint Cal webhook token");
  }
  return settled.calWebhookToken;
}

export function buildCalWebhookUrl(token: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://leasestack.co"
  ).replace(/\/+$/, "");
  return `${base}/api/webhooks/cal/${token}`;
}

// ---------------------------------------------------------------------------
// Booking processing — shared by the route handler and tests. Every Lead /
// Tour write is scoped to `orgId`, which is resolved from the token (NOT from
// any client-supplied value), so a forged payload can never reach another
// tenant's pipeline.
// ---------------------------------------------------------------------------

export type CalAttendee = { email?: string; name?: string; timeZone?: string };
export type CalPayload = {
  uid?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  attendees?: CalAttendee[];
  organizer?: { email?: string; name?: string };
  additionalNotes?: string;
  eventType?: { slug?: string; title?: string };
  responses?: Record<string, unknown>;
};

export type CalTrigger =
  | "BOOKING_CREATED"
  | "BOOKING_RESCHEDULED"
  | "BOOKING_CANCELLED";

export type CalProcessResult =
  | { ok: true; action: "ignored"; trigger: string }
  | { ok: false; status: number; error: string }
  | { ok: true; action: "cancelled" }
  | { ok: true; action: "created" | "rescheduled"; leadId: string };

export function isHandledTrigger(trigger: string): trigger is CalTrigger {
  return (
    trigger === "BOOKING_CREATED" ||
    trigger === "BOOKING_RESCHEDULED" ||
    trigger === "BOOKING_CANCELLED"
  );
}

export async function processCalBooking(args: {
  orgId: string;
  trigger: string;
  payload: CalPayload;
}): Promise<CalProcessResult> {
  const { orgId, trigger, payload } = args;

  if (!isHandledTrigger(trigger)) {
    // Unknown triggers ack with 200 — Cal retries on 5xx and we don't want to
    // burn the error budget on event types we don't consume yet.
    return { ok: true, action: "ignored", trigger };
  }

  const calUid = payload.uid;
  const attendee = payload.attendees?.[0];
  const attendeeEmail = attendee?.email?.toLowerCase().trim();
  if (!calUid || !attendeeEmail) {
    return {
      ok: false,
      status: 400,
      error: "Missing required payload fields (uid, attendee.email)",
    };
  }

  const fullName = (attendee?.name ?? "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.length > 0 ? rest.join(" ") : null;

  const scheduledAt = payload.startTime ? new Date(payload.startTime) : null;
  const eventTitle = payload.eventType?.title ?? payload.title ?? "Cal booking";
  const notes = [payload.additionalNotes, eventTitle]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 500);

  // Tour rows require a propertyId. Cal doesn't know LeaseStack properties, so
  // fall back to the org's first ACTIVE property. Multi-property tenants get a
  // default the operator can re-assign; zero ACTIVE properties → capture the
  // Lead only.
  const defaultProperty = await prisma.property.findFirst({
    where: { orgId, lifecycle: "ACTIVE" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (trigger === "BOOKING_CANCELLED") {
    const existing = await prisma.tour.findFirst({
      where: {
        externalSystem: CAL_EXTERNAL_SYSTEM,
        externalId: calUid,
        property: { orgId },
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.tour.update({
        where: { id: existing.id },
        data: { status: TourStatus.CANCELLED, scheduledAt: null },
      });
    }
    return { ok: true, action: "cancelled" };
  }

  // Upsert Lead. Match by email within the org. If found, never demote status.
  const existingLead = await prisma.lead.findFirst({
    where: { orgId, email: { equals: attendeeEmail, mode: "insensitive" } },
    select: { id: true, status: true },
  });
  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          lastActivityAt: new Date(),
          status:
            existingLead.status === LeadStatus.NEW
              ? LeadStatus.TOUR_SCHEDULED
              : existingLead.status,
        },
        select: { id: true, source: true },
      })
    : await prisma.lead.create({
        data: {
          orgId,
          source: LeadSource.REFERRAL,
          sourceDetail: `cal.com${payload.eventType?.slug ? ` · ${payload.eventType.slug}` : ""}`,
          firstName: firstName || null,
          lastName: lastName || null,
          email: attendeeEmail,
          status: LeadStatus.TOUR_SCHEDULED,
          notes: notes || null,
        },
        select: { id: true, source: true },
      });

  // Upsert Tour keyed on (externalSystem='cal', Cal uid) for idempotency.
  if (defaultProperty) {
    const existingTour = await prisma.tour.findFirst({
      where: {
        externalSystem: CAL_EXTERNAL_SYSTEM,
        externalId: calUid,
        property: { orgId },
      },
      select: { id: true },
    });
    if (existingTour) {
      await prisma.tour.update({
        where: { id: existingTour.id },
        data: {
          scheduledAt,
          status: TourStatus.SCHEDULED,
          notes: notes || null,
        },
      });
    } else {
      await prisma.tour.create({
        data: {
          leadId: lead.id,
          propertyId: defaultProperty.id,
          externalSystem: CAL_EXTERNAL_SYSTEM,
          externalId: calUid,
          status: TourStatus.SCHEDULED,
          scheduledAt,
          notes: notes || null,
        },
      });
    }
  }

  // Notify operators on first capture only — same path every other lead site
  // uses. Failure must never block the ack (Cal would retry → double-insert).
  if (!existingLead) {
    try {
      await notifyLeadCaptured({
        orgId,
        leadId: lead.id,
        propertyId: null,
        channel: LeadNotifyChannel.TOUR,
        lead: {
          name: fullName || null,
          email: attendeeEmail,
          phone: null,
          sourceLabel: "Cal.com booking",
        },
      });
    } catch (err) {
      console.warn("[cal-webhook] notifyLeadCaptured failed", err);
    }
  }

  return {
    ok: true,
    action: trigger === "BOOKING_CREATED" ? "created" : "rescheduled",
    leadId: lead.id,
  };
}
