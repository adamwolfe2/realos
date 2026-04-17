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
  VisitorIdentificationStatus,
  Prisma,
} from "@prisma/client";
import {
  sendLeadAutoReplyEmail,
  notifyTenantOfLeadEmail,
} from "@/lib/email/lead-emails";
import { notifyNewIntake as notifyNewLeadSlack } from "@/lib/integrations/slack";

const schema = z.object({
  orgId: z.string().min(1),
  propertyId: z.string().optional(),
  source: z.nativeEnum(LeadSource),
  sourceDetail: z.string().max(200).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  preferredUnitType: z.string().max(100).optional(),
  desiredMoveIn: z.string().optional(),
  budgetMax: z.string().optional(),
  notes: z.string().max(2000).optional(),
  visitorHash: z.string().optional(),
});

// POST /api/public/leads
// Called by tenant marketing site forms (apply, contact, exit-intent).
// Rate-limited by IP so a competitor can't flood a tenant.
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

  // Confirm the tenant exists and is a CLIENT.
  const org = await prisma.organization.findUnique({
    where: { id: data.orgId },
    select: {
      id: true,
      name: true,
      orgType: true,
      primaryContactEmail: true,
      tenantSiteConfig: { select: { phoneNumber: true, contactEmail: true } },
    },
  });
  if (!org || org.orgType !== "CLIENT") {
    return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  }

  // Confirm the property (if passed) belongs to this tenant.
  if (data.propertyId) {
    const ok = await prisma.property.findFirst({
      where: { id: data.propertyId, orgId: data.orgId },
      select: { id: true },
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Property not part of this tenant" },
        { status: 400 }
      );
    }
  }

  let budgetMaxCents: number | null = null;
  if (data.budgetMax && !Number.isNaN(Number(data.budgetMax))) {
    budgetMaxCents = Math.round(Number(data.budgetMax) * 100);
  }

  const lead = await prisma.lead.create({
    data: {
      orgId: data.orgId,
      propertyId: data.propertyId ?? null,
      source: data.source,
      sourceDetail: data.sourceDetail ?? null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      email: data.email || null,
      phone: data.phone || null,
      preferredUnitType: data.preferredUnitType || null,
      desiredMoveIn:
        data.desiredMoveIn && !Number.isNaN(Date.parse(data.desiredMoveIn))
          ? new Date(data.desiredMoveIn)
          : null,
      budgetMaxCents,
      notes: data.notes ?? null,
    },
  });

  // Link to Visitor if we have a hash.
  if (data.visitorHash) {
    await prisma.visitor.updateMany({
      where: { orgId: data.orgId, visitorHash: data.visitorHash },
      data: {
        status: VisitorIdentificationStatus.MATCHED_TO_LEAD,
        convertedAt: new Date(),
      },
    });
  }

  // Fire-and-forget side effects.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const moduleCount = 1;

  void Promise.allSettled([
    notifyNewLeadSlack({
      companyName: org.name,
      contactName:
        [data.firstName, data.lastName].filter(Boolean).join(" ") ||
        data.email ||
        "Anonymous",
      contactEmail: data.email ?? "unknown@unknown.local",
      propertyType: data.source,
      moduleCount,
      intakeId: lead.id,
      appUrl,
    }),
    data.email
      ? sendLeadAutoReplyEmail({
          to: data.email,
          firstName: data.firstName,
          orgName: org.name,
          phone: org.tenantSiteConfig?.phoneNumber ?? null,
        })
      : Promise.resolve({
          ok: false,
          error: "no lead email to auto-reply",
        } as Prisma.JsonObject),
    org.primaryContactEmail
      ? notifyTenantOfLeadEmail({
          to: org.primaryContactEmail,
          orgName: org.name,
          leadId: lead.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          source: data.source,
          sourceDetail: data.sourceDetail,
          preferredUnitType: data.preferredUnitType,
          notes: data.notes,
          appUrl,
        })
      : Promise.resolve({ ok: false, error: "no primary contact email" }),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === "rejected") {
        console.warn("[public/leads] notification error:", r.reason);
      }
    }
  });

  return NextResponse.json(
    { ok: true, leadId: lead.id },
    { status: 201 }
  );
}
