import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  publicSignupLimiter,
  checkRateLimit,
  getIp,
} from "@/lib/rate-limit";
import {
  LeadSource,
  LeadStatus,
  TourStatus,
  Prisma,
} from "@prisma/client";
import { notifyTourScheduled } from "@/lib/notifications/create";

const schema = z.object({
  orgId: z.string().min(1),
  propertyId: z.string().min(1),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  scheduledAt: z.string().datetime().optional(),
  tourType: z.enum(["in_person", "virtual", "self_guided"]).optional(),
  notes: z.string().max(2000).optional(),
});

// POST /api/public/tours
// Creates a Tour row + upserts a Lead keyed on (orgId, email). Public,
// rate-limited. Marks the lead as TOUR_SCHEDULED when a time is submitted.
export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(publicSignupLimiter, ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

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

  // Confirm ownership: property belongs to orgId, org is a CLIENT.
  const property = await prisma.property.findFirst({
    where: { id: data.propertyId, orgId: data.orgId },
    select: { id: true, orgId: true, org: { select: { orgType: true } } },
  });
  if (!property || property.org.orgType !== "CLIENT") {
    return NextResponse.json(
      { error: "Unknown property" },
      { status: 404 }
    );
  }

  // Find or create the lead.
  const existing = await prisma.lead.findFirst({
    where: { orgId: data.orgId, email: data.email },
    select: { id: true },
  });

  const lead = existing
    ? await prisma.lead.update({
        where: { id: existing.id },
        data: {
          propertyId: data.propertyId,
          firstName: data.firstName ?? undefined,
          lastName: data.lastName ?? undefined,
          phone: data.phone ?? undefined,
          status: LeadStatus.TOUR_SCHEDULED,
          lastActivityAt: new Date(),
        } as Prisma.LeadUpdateInput,
      })
    : await prisma.lead.create({
        data: {
          orgId: data.orgId,
          propertyId: data.propertyId,
          email: data.email,
          firstName: data.firstName ?? null,
          lastName: data.lastName ?? null,
          phone: data.phone ?? null,
          source: LeadSource.FORM,
          sourceDetail: "tour_request",
          status: LeadStatus.TOUR_SCHEDULED,
        },
      });

  const tour = await prisma.tour.create({
    data: {
      leadId: lead.id,
      propertyId: data.propertyId,
      status: data.scheduledAt
        ? TourStatus.SCHEDULED
        : TourStatus.REQUESTED,
      tourType: data.tourType ?? "in_person",
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      notes: data.notes ?? null,
    },
  });

  const leadName = [data.firstName, data.lastName].filter(Boolean).join(" ") || data.email;
  void notifyTourScheduled({
    id: tour.id,
    leadId: lead.id,
    orgId: data.orgId,
    scheduledAt: tour.scheduledAt,
    tourType: tour.tourType,
    leadName,
  }).catch(() => {});

  return NextResponse.json(
    { ok: true, leadId: lead.id, tourId: tour.id },
    { status: 201 }
  );
}
