import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  webhookLimiter,
  checkRateLimit,
  getIp,
  rateLimited,
} from "@/lib/rate-limit";
import {
  LeadNotifyChannel,
  LeadSource,
  LeadStatus,
  TourStatus,
} from "@prisma/client";
import { notifyLeadCaptured } from "@/lib/notifications/lead-notify";

// ---------------------------------------------------------------------------
// POST /api/webhooks/cal/[orgId]
//
// Generic Cal.com webhook receiver. An operator pastes
// https://www.leasestack.co/api/webhooks/cal/<their-org-id> into the
// "Subscriber URL" field of any Cal.com webhook (Booking created /
// rescheduled / cancelled). When a prospect books a slot, Cal POSTs the
// payload here, we upsert a Lead by email and create a Tour row scoped
// to the operator's org.
//
// Auth model: the orgId path segment is a random 25-char cuid that's
// unguessable in practice. Combined with the per-IP webhook rate limit,
// the surface is safe enough for v1 — Cal doesn't currently let us
// supply a custom header, and their signature scheme requires a secret
// configured per webhook (deferred to v2).
//
// Idempotency: bookings are upserted by Cal's `uid` (Tour.externalId
// scoped to externalSystem='cal'). Reschedule/cancel events update the
// existing Tour. Duplicate fires on the same uid are no-ops.
//
// Cal.com webhook event payload shape (excerpt — only what we use):
//   {
//     triggerEvent: "BOOKING_CREATED" | "BOOKING_RESCHEDULED" |
//                   "BOOKING_CANCELLED",
//     payload: {
//       uid: "abc123-...",
//       title: "30 min tour with Norman Gensinger",
//       startTime: "2026-06-05T14:00:00Z",
//       endTime: "2026-06-05T14:30:00Z",
//       attendees: [{ email, name, timeZone }],
//       organizer: { email, name },
//       additionalNotes?: string,
//       eventType?: { slug, title },
//       responses?: Record<string, unknown>,
//     }
//   }
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;
const CAL_EXTERNAL_SYSTEM = "cal";

type CalAttendee = {
  email?: string;
  name?: string;
  timeZone?: string;
};

type CalPayload = {
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

type CalWebhookEvent = {
  triggerEvent?: string;
  payload?: CalPayload;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  // Rate limit per IP — cheap defense against scraping/replay even with
  // an unguessable orgId in the path.
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(webhookLimiter, `wh-cal:${ip}`);
  if (!allowed) {
    return rateLimited("Rate limit exceeded", 60);
  }

  const { orgId } = await params;

  // Cuid format check before any DB work so probe-by-random-string
  // attacks die at the regex.
  if (!/^c[a-z0-9]{20,40}$/.test(orgId)) {
    return NextResponse.json({ error: "Invalid org token" }, { status: 400 });
  }

  // Cap body before parsing — Cal payloads are small (<2KB) but a
  // hostile sender could try to balloon memory.
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: CalWebhookEvent;
  try {
    body = JSON.parse(raw) as CalWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const trigger = body.triggerEvent ?? "";
  const payload = body.payload ?? {};

  if (
    trigger !== "BOOKING_CREATED" &&
    trigger !== "BOOKING_RESCHEDULED" &&
    trigger !== "BOOKING_CANCELLED"
  ) {
    // Unknown triggers are a 200 — Cal will keep retrying on 5xx, and
    // we don't want to spam our error budget for event types we don't
    // care about yet (BOOKING_REQUESTED, MEETING_ENDED, etc.).
    return NextResponse.json({ ok: true, ignored: trigger });
  }

  const calUid = payload.uid;
  const attendee = payload.attendees?.[0];
  const attendeeEmail = attendee?.email?.toLowerCase().trim();
  if (!calUid || !attendeeEmail) {
    return NextResponse.json(
      { error: "Missing required payload fields (uid, attendee.email)" },
      { status: 400 },
    );
  }

  // Verify the org exists. Belt-and-suspenders against a Cal config
  // pointed at a deleted org.
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Unknown org" }, { status: 404 });
  }

  // Split attendee name. Cal sends a single "name" field.
  const fullName = (attendee?.name ?? "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.length > 0 ? rest.join(" ") : null;

  const scheduledAt = payload.startTime ? new Date(payload.startTime) : null;
  const eventTitle = payload.eventType?.title ?? payload.title ?? "Cal booking";
  const notes = [payload.additionalNotes, eventTitle]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 500);

  // Tour rows require a propertyId. Cal doesn't know about LeaseStack
  // properties, so we fall back to the org's first ACTIVE (marketable)
  // property. Single-property tenants get the right answer for free;
  // multi-property tenants get a default the operator can re-assign
  // from the lead detail page. If the org has zero ACTIVE properties
  // we skip Tour creation and still capture the Lead.
  const defaultProperty = await prisma.property.findFirst({
    where: { orgId, lifecycle: "ACTIVE" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (trigger === "BOOKING_CANCELLED") {
    // Cancel — mark existing Tour as CANCELLED if we have it; never
    // delete the Lead (operator may want to follow up).
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
    return NextResponse.json({ ok: true, action: "cancelled" });
  }

  // Upsert Lead. Match by email first within the org. If found, leave
  // status alone (don't demote); update lastActivityAt + name.
  const existingLead = await prisma.lead.findFirst({
    where: {
      orgId,
      email: { equals: attendeeEmail, mode: "insensitive" },
    },
    select: { id: true, status: true },
  });
  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          lastActivityAt: new Date(),
          // Promote NEW → TOUR_SCHEDULED; preserve any later status.
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

  // Upsert Tour scoped to externalSystem='cal' + Cal uid for
  // idempotency. Reschedule fires update the scheduledAt; create
  // inserts. Skips Tour creation when there's no default property
  // (Lead still captured).
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

  // Fire operator notifications — same path every other lead-capture
  // site uses (chatbot, popup, form, AppFolio, pixel). Honors org-level
  // + per-property notification settings.
  if (!existingLead) {
    try {
      // Cal bookings are tour requests by nature — route through the
      // TOUR notification channel so they hit the same email path as
      // form-based tour requests + existing AppFolio showings.
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
      // Notification failure must never block the webhook ack — Cal
      // would retry and we'd double-insert. Log + 200.
      console.warn("[cal-webhook] notifyLeadCaptured failed", err);
    }
  }

  return NextResponse.json({
    ok: true,
    action: trigger === "BOOKING_CREATED" ? "created" : "rescheduled",
    leadId: lead.id,
  });
}
