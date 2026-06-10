import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireScope,
  requireWritableWorkspace,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import {
  LeadSource,
  LeadStatus,
  VisitorIdentificationStatus,
  LeadNotifyChannel,
} from "@prisma/client";
import { notifyLeadCaptured } from "@/lib/notifications/lead-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/tenant/visitors/[visitorId]/convert
//
// Operator-initiated conversion of an IDENTIFIED visitor into a tracked Lead.
// Demo wow path: Norman clicks "Convert to lead" on a Cursive-identified
// visitor, we mint a Lead row using the visitor's enriched name + email +
// city/state, link it back via Lead.visitorId, and bump the visitor's
// status to MATCHED_TO_LEAD so the visitor feed reflects the conversion.
//
// Idempotent: if a Lead already exists for this visitor (linked by
// visitorId or matching on email within the org), returns that lead
// instead of creating a duplicate.
// ---------------------------------------------------------------------------
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ visitorId: string }> },
) {
  let scope: Awaited<ReturnType<typeof requireScope>>;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { visitorId } = await ctx.params;
  const visitor = await prisma.visitor.findFirst({
    where: { id: visitorId, ...tenantWhere(scope) },
  });
  if (!visitor) {
    return NextResponse.json({ error: "Visitor not found" }, { status: 404 });
  }
  if (!visitor.email) {
    return NextResponse.json(
      {
        error:
          "Visitor has no email yet — cannot convert to a tracked Lead.",
      },
      { status: 400 },
    );
  }

  // Idempotency.
  const existing = await prisma.lead.findFirst({
    where: {
      orgId: visitor.orgId,
      OR: [
        { visitorId: visitor.id },
        { email: visitor.email.toLowerCase() },
      ],
    },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      leadId: existing.id,
      created: false,
    });
  }

  // Pull city/state from enrichedData for the note. Cursive emits
  // PERSONAL_CITY / PERSONAL_STATE.
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
      email: visitor.email.toLowerCase(),
      phone: visitor.phone ?? null,
      notes:
        [
          "Converted from a pixel-identified visitor via the Visitor feed.",
          locationLine ? `Location: ${locationLine}.` : null,
          referrer && referrer !== "$direct"
            ? `Last landing: ${referrer}.`
            : null,
        ]
          .filter(Boolean)
          .join(" ") || "Converted from a pixel-identified visitor.",
      status: LeadStatus.NEW,
    },
  });

  await prisma.visitor.update({
    where: { id: visitor.id },
    data: {
      status: VisitorIdentificationStatus.MATCHED_TO_LEAD,
      convertedAt: new Date(),
    },
  });

  // Instant operator email — visitor → lead is a high-signal moment that
  // operators often miss because the conversion happens in the portal
  // (not at the lead's hand), so the email is the only nudge they get.
  void notifyLeadCaptured({
    orgId: visitor.orgId,
    leadId: lead.id,
    propertyId: visitor.propertyId ?? null,
    channel: LeadNotifyChannel.VISITOR_CONVERT,
    lead: {
      name:
        [visitor.firstName, visitor.lastName].filter(Boolean).join(" ") ||
        visitor.email,
      email: visitor.email.toLowerCase(),
      phone: visitor.phone ?? null,
      sourceLabel: "Pixel-identified visitor",
      intent: locationLine,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, leadId: lead.id, created: true });
}
