import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  LeadSource,
  LeadStatus,
  PopupEventType,
  VisitorIdentificationStatus,
} from "@prisma/client";
import {
  publicSignupLimiter,
  checkRateLimit,
  getIp,
  WIDGET_FALLBACK,
} from "@/lib/rate-limit";
import {
  sendLeadAutoReplyEmail,
  notifyTenantOfLeadEmail,
} from "@/lib/email/lead-emails";
import { notifyNewIntake as notifyNewLeadSlack } from "@/lib/integrations/slack";
import { notifyLeadCreated } from "@/lib/notifications/create";
import { notifyLeadCaptured } from "@/lib/notifications/lead-notify";
import { LeadNotifyChannel } from "@prisma/client";
import { recordPopupEvent } from "@/lib/popups/queries";

// ---------------------------------------------------------------------------
// POST /api/public/popup/lead
//
// Dedicated popup-conversion endpoint, mirrors /api/public/chatbot/lead.
// Pre-fix the embed posted to /api/public/leads with `{ tenantSlug,
// propertySlug, source: "popup" }` — a payload shape that endpoint's
// Zod schema doesn't accept (it requires `orgId` + a LeadSource enum
// value, and there's no LeadSource.POPUP). The request was 400'd before
// it ever reached the DB, so:
//
//   - no Lead row ever got created
//   - no Slack / Resend / in-app notifications fired
//   - no Visitor was promoted to MATCHED_TO_LEAD
//
// The CONVERTED PopupEvent still recorded so the campaign analytics
// counter looked healthy, hiding the leak. This route resolves
// tenantSlug → orgId server-side, optional propertySlug → propertyId,
// and writes through the same end-of-funnel side-effects the chatbot
// captures use, so popup conversions show up everywhere a Lead is
// expected (CRM, dashboard, /portal/leads, Slack, primary contact
// email, visitor identification).
//
// CORS: wide open (same as /config + /events). The popup embed runs on
// arbitrary third-party sites.
// Rate limit: same publicSignupLimiter (5/hour/IP) used by the existing
// /api/public/leads route, so a competitor can't flood a tenant with
// fake conversions.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const bodySchema = z.object({
  tenantSlug: z.string().min(1).max(120),
  propertySlug: z.string().max(120).optional(),
  popupId: z.string().min(1).max(40),
  email: z.string().trim().toLowerCase().email().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  pageUrl: z.string().max(2000).optional(),
  visitorHash: z.string().max(120).optional(),
});

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(publicSignupLimiter, ip, {
    softFallback: WIDGET_FALLBACK.publicSignup,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": "3600" } },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  const data = parsed.data;

  // At least one contact channel is required. The popup editor lets
  // operators toggle email-only / phone-only / both; we trust that
  // surface to gate the form but defend here too.
  if (!data.email && !data.phone) {
    return NextResponse.json(
      { error: "Provide an email or phone." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Resolve tenantSlug → orgId server-side. We deliberately do NOT
  // trust an orgId from the client — the popup embed never sends one,
  // and accepting one would let an attacker forge conversions against
  // any tenant.
  const org = await prisma.organization.findUnique({
    where: { slug: data.tenantSlug },
    select: {
      id: true,
      orgType: true,
      name: true,
      modulePopups: true,
      primaryContactEmail: true,
      tenantSiteConfig: { select: { phoneNumber: true } },
    },
  });
  if (!org || org.orgType !== "CLIENT" || !org.modulePopups) {
    // Soft-deny — same shape as /config returning empty so the embed
    // quietly stops trying. We do NOT leak whether the slug exists.
    return NextResponse.json(
      { ok: false, recorded: false },
      { status: 200, headers: CORS_HEADERS },
    );
  }

  // Confirm the popup belongs to this org. The popupId is operator-
  // controlled (it's in the script tag) so this also catches stale
  // snippets pointing at deleted campaigns.
  const popup = await prisma.popupCampaign.findFirst({
    where: { id: data.popupId, orgId: org.id },
    select: { id: true, propertyId: true },
  });
  if (!popup) {
    return NextResponse.json(
      { ok: false, recorded: false },
      { status: 200, headers: CORS_HEADERS },
    );
  }

  // Resolve propertySlug → propertyId. Prefer the campaign's own
  // propertyId (if set on the popup itself) so multi-property campaigns
  // attribute correctly even if the script tag drops the property
  // attribute. Falls back to the property slug from the script tag,
  // then to null (org-level lead).
  let propertyId: string | null = popup.propertyId ?? null;
  if (!propertyId && data.propertySlug) {
    const prop = await prisma.property.findFirst({
      where: { orgId: org.id, slug: data.propertySlug },
      select: { id: true },
    });
    propertyId = prop?.id ?? null;
  }

  // Upsert by (orgId, email) so the same visitor converting twice on
  // two different popups doesn't create duplicate Lead rows — they
  // get their lastActivityAt bumped and pick up the missing phone if
  // they provided one this time. Falls back to (orgId, phone) when
  // email is absent (phone-only campaigns).
  let leadId: string;
  const sourceDetail = `popup:${popup.id}`;
  const notesLine = `Captured by popup on ${data.pageUrl ?? "site"}`;

  const existing = data.email
    ? await prisma.lead.findFirst({
        where: { orgId: org.id, email: data.email },
        select: { id: true, phone: true, propertyId: true },
      })
    : data.phone
      ? await prisma.lead.findFirst({
          where: { orgId: org.id, phone: data.phone },
          select: { id: true, phone: true, propertyId: true },
        })
      : null;

  if (existing) {
    const updated = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        lastActivityAt: new Date(),
        phone: existing.phone ?? data.phone ?? null,
        // Don't overwrite an existing property attribution — the lead
        // may have come in through a different building first.
        propertyId: existing.propertyId ?? propertyId,
      },
      select: { id: true },
    });
    leadId = updated.id;
  } else {
    const created = await prisma.lead.create({
      data: {
        orgId: org.id,
        propertyId,
        source: LeadSource.FORM,
        sourceDetail,
        status: LeadStatus.NEW,
        email: data.email ?? null,
        phone: data.phone ?? null,
        notes: notesLine,
      },
      select: {
        id: true,
        orgId: true,
        firstName: true,
        lastName: true,
        email: true,
        source: true,
      },
    });
    leadId = created.id;

    // In-app notification (the bell in /portal). Only for net-new
    // leads — bumping lastActivityAt on an existing lead shouldn't
    // generate a duplicate notification. AWAIT this — a fire-and-forget
    // promise on a Vercel serverless function gets dropped the moment
    // the route returns (the lambda is suspended/recycled before
    // unawaited work completes). Pre-fix this was lost on every
    // popup conversion in prod, silently breaking the bell badge.
    try {
      await notifyLeadCreated(created);
    } catch (err) {
      console.warn("[public/popup/lead] notifyLeadCreated failed:", err);
    }

    // Instant operator email — only for net-new leads. Existing leads
    // already lit up the operator's inbox when they first came in.
    void notifyLeadCaptured({
      orgId: org.id,
      leadId,
      propertyId,
      channel: LeadNotifyChannel.POPUP,
      lead: {
        name: created.firstName ?? created.lastName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        sourceLabel: sourceDetail,
      },
    }).catch(() => {});
  }

  // Record the CONVERTED event server-side here, atomically with the
  // Lead creation, instead of relying on the embed to fire a separate
  // POST to /api/public/popup/events. We AWAIT this — same serverless
  // reasoning as notifyLeadCreated above. recordPopupEvent runs in
  // its own transaction so the counter increment is safe under
  // concurrent CONVERTED events from the same campaign.
  try {
    await recordPopupEvent({
      orgId: org.id,
      campaignId: popup.id,
      type: PopupEventType.CONVERTED,
      sessionId: undefined,
      leadId,
      pageUrl: data.pageUrl,
    });
  } catch (err) {
    console.warn("[public/popup/lead] recordPopupEvent failed:", err);
  }

  // Visitor → MATCHED_TO_LEAD bump so attribution analytics can
  // close the loop from pixel session to identified lead.
  if (data.visitorHash) {
    await prisma.visitor.updateMany({
      where: { orgId: org.id, visitorHash: data.visitorHash },
      data: {
        status: VisitorIdentificationStatus.MATCHED_TO_LEAD,
        convertedAt: new Date(),
      },
    });
  }

  // Operator notifications — fire-and-forget so a Slack outage or
  // Resend hiccup never breaks the lead capture. Slack message uses
  // the same notifyNewIntake shape as /api/public/leads so the
  // operator's inbox stays consistent across surfaces.
  //
  // AWAIT the fan-out instead of void-ing it. Vercel serverless drops
  // unawaited promises the moment the function returns, so the
  // pre-fix Slack/Resend notifications were silently lost on every
  // conversion. The fan-out adds ~200-400ms to the response, which
  // is acceptable for a one-shot conversion form (operator submits
  // and waits for the success state anyway).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const notifyResults = await Promise.allSettled([
    notifyNewLeadSlack({
      companyName: org.name,
      contactName: data.email ?? data.phone ?? "Anonymous",
      contactEmail: data.email ?? "unknown@unknown.local",
      propertyType: "popup",
      moduleCount: 1,
      intakeId: leadId,
      appUrl,
    }),
    data.email
      ? sendLeadAutoReplyEmail({
          to: data.email,
          firstName: null,
          orgName: org.name,
          phone: org.tenantSiteConfig?.phoneNumber ?? null,
        })
      : Promise.resolve(null),
    org.primaryContactEmail
      ? notifyTenantOfLeadEmail({
          to: org.primaryContactEmail,
          orgName: org.name,
          leadId,
          firstName: null,
          lastName: null,
          email: data.email ?? null,
          phone: data.phone ?? null,
          source: "popup",
          sourceDetail,
          preferredUnitType: null,
          notes: notesLine,
          appUrl,
        })
      : Promise.resolve(null),
  ]);
  for (const r of notifyResults) {
    if (r.status === "rejected") {
      console.warn("[public/popup/lead] notification error:", r.reason);
    }
  }

  return NextResponse.json(
    { ok: true, leadId },
    { status: 201, headers: CORS_HEADERS },
  );
}
