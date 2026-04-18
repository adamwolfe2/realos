import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { LeadStatus, TourStatus } from "@prisma/client";
import { guardIngest } from "@/lib/api-keys/ingest-shared";

// POST /api/ingest/tour
//
// Generic tour ingestion. Resolves the lead by id or email, validates property
// ownership, creates a SCHEDULED Tour, and auto-advances the lead status to
// TOUR_SCHEDULED when it's still NEW or CONTACTED.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    leadEmail: z.string().trim().email().max(320).optional(),
    leadId: z.string().trim().min(1).max(64).optional(),
    propertyId: z.string().trim().min(1).max(64),
    scheduledAt: z.string().datetime(),
    tourType: z.enum(["in_person", "virtual", "self_guided"]).optional(),
    notes: z.string().trim().max(2000).optional(),
    externalId: z.string().trim().max(200).optional(),
  })
  .refine((v) => Boolean(v.leadEmail || v.leadId), {
    message: "Either leadId or leadEmail is required",
    path: ["leadEmail"],
  });

export async function POST(req: NextRequest) {
  const gate = await guardIngest(req, "ingest:tour");
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

  const lead = data.leadId
    ? await prisma.lead.findFirst({
        where: { id: data.leadId, orgId },
        select: { id: true, status: true },
      })
    : await prisma.lead.findFirst({
        where: { orgId, email: data.leadEmail!.toLowerCase() },
        select: { id: true, status: true },
      });

  if (!lead) {
    return NextResponse.json(
      { error: "Lead not found for this tenant" },
      { status: 404 }
    );
  }

  const notes =
    data.notes ??
    (data.externalId ? `external:${data.externalId}` : null);

  const tour = await prisma.tour.create({
    data: {
      leadId: lead.id,
      propertyId: data.propertyId,
      status: TourStatus.SCHEDULED,
      tourType: data.tourType ?? "in_person",
      scheduledAt: new Date(data.scheduledAt),
      notes,
    },
    select: { id: true },
  });

  if (
    lead.status === LeadStatus.NEW ||
    lead.status === LeadStatus.CONTACTED
  ) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: LeadStatus.TOUR_SCHEDULED,
        lastActivityAt: new Date(),
      },
    });
  }

  return NextResponse.json(
    { ok: true, id: tour.id, leadId: lead.id },
    { status: 201 }
  );
}
