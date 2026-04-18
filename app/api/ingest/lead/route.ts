import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { LeadSource, LeadStatus, Prisma } from "@prisma/client";
import { guardIngest } from "@/lib/api-keys/ingest-shared";
import { notifyLeadCaptured } from "@/lib/chatbot/notify-lead";

// POST /api/ingest/lead
//
// Generic lead ingestion for any external source (Zapier, Typeform, Make,
// bespoke forms). Upserts by (orgId, lowercased email) and merges non-null
// fields. Fires the tenant "new lead" email notification fire-and-forget.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional(),
  source: z.string().trim().max(64).optional(),
  sourceDetail: z.string().trim().max(200).optional(),
  propertyId: z.string().trim().min(1).max(64).optional(),
  notes: z.string().trim().max(2000).optional(),
  desiredMoveIn: z.string().trim().optional(),
  budgetMaxCents: z.number().int().nonnegative().optional(),
  externalId: z.string().trim().max(200).optional(),
});

function coerceLeadSource(raw: string | undefined): LeadSource {
  if (!raw) return LeadSource.OTHER;
  const normalized = raw.trim().toUpperCase().replace(/[-\s]+/g, "_");
  const enumValues = Object.values(LeadSource) as string[];
  if (enumValues.includes(normalized)) {
    return normalized as LeadSource;
  }
  return LeadSource.OTHER;
}

export async function POST(req: NextRequest) {
  const gate = await guardIngest(req, "ingest:lead");
  if (!gate.ok) return gate.response;
  const { orgId } = gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const email = data.email.toLowerCase();

  if (data.propertyId) {
    const property = await prisma.property.findFirst({
      where: { id: data.propertyId, orgId },
      select: { id: true },
    });
    if (!property) {
      return NextResponse.json(
        { error: "Property not part of this tenant" },
        { status: 400 }
      );
    }
  }

  const source = coerceLeadSource(data.source);
  const sourceDetail =
    data.sourceDetail ??
    (data.externalId ? `external:${data.externalId}` : null);

  const desiredMoveIn =
    data.desiredMoveIn && !Number.isNaN(Date.parse(data.desiredMoveIn))
      ? new Date(data.desiredMoveIn)
      : null;

  const now = new Date();

  const existing = await prisma.lead.findFirst({
    where: { orgId, email },
    select: { id: true },
  });

  let leadId: string;
  let isNew = false;

  if (existing) {
    const update: Prisma.LeadUpdateInput = {
      lastActivityAt: now,
    };
    if (data.firstName) update.firstName = data.firstName;
    if (data.lastName) update.lastName = data.lastName;
    if (data.phone) update.phone = data.phone;
    if (data.propertyId)
      update.property = { connect: { id: data.propertyId } };
    if (sourceDetail) update.sourceDetail = sourceDetail;
    if (data.notes) update.notes = data.notes;
    if (desiredMoveIn) update.desiredMoveIn = desiredMoveIn;
    if (typeof data.budgetMaxCents === "number")
      update.budgetMaxCents = data.budgetMaxCents;

    const updated = await prisma.lead.update({
      where: { id: existing.id },
      data: update,
      select: { id: true },
    });
    leadId = updated.id;
  } else {
    const created = await prisma.lead.create({
      data: {
        orgId,
        propertyId: data.propertyId ?? null,
        email,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        phone: data.phone ?? null,
        source,
        sourceDetail,
        status: LeadStatus.NEW,
        notes: data.notes ?? null,
        desiredMoveIn,
        budgetMaxCents:
          typeof data.budgetMaxCents === "number"
            ? data.budgetMaxCents
            : null,
      },
      select: { id: true },
    });
    leadId = created.id;
    isNew = true;
  }

  // Fire-and-forget tenant notification. Only fire on new leads so we don't
  // spam the operator when an external system retries a known email.
  if (isNew) {
    void notifyLeadCaptured({ orgId, leadId }).catch((err) => {
      console.warn("[ingest/lead] notify error", err);
    });
  }

  return NextResponse.json(
    { ok: true, id: leadId, created: isNew },
    { status: isNew ? 201 : 200 }
  );
}
