import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  tenantWhere,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import {
  AuditAction,
  LeadSource,
  LeadStatus,
  Prisma,
} from "@prisma/client";

const createSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  source: z.nativeEnum(LeadSource),
  sourceDetail: z.string().max(200).optional(),
  propertyId: z.string().optional(),
  notes: z.string().max(2000).optional(),
  desiredMoveIn: z.string().datetime().optional(),
  budgetMinCents: z.number().int().nonnegative().optional(),
  budgetMaxCents: z.number().int().nonnegative().optional(),
  preferredUnitType: z.string().max(100).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const scope = await requireScope();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as LeadStatus | null;
    const source = url.searchParams.get("source") as LeadSource | null;
    const q = url.searchParams.get("q");

    const where: Prisma.LeadWhereInput = { ...tenantWhere(scope) };
    if (status && status in LeadStatus) where.status = status;
    if (source && source in LeadSource) where.source = source;
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }

    const rows = await prisma.lead.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      take: 500,
      include: { property: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ rows });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = await requireScope();
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // If propertyId is passed, confirm it belongs to the tenant.
    if (data.propertyId) {
      const owned = await prisma.property.findFirst({
        where: { id: data.propertyId, ...tenantWhere(scope) },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json(
          { error: "Property does not belong to this tenant" },
          { status: 403 }
        );
      }
    }

    const created = await prisma.lead.create({
      data: {
        orgId: scope.orgId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        source: data.source,
        sourceDetail: data.sourceDetail,
        propertyId: data.propertyId,
        notes: data.notes,
        desiredMoveIn: data.desiredMoveIn
          ? new Date(data.desiredMoveIn)
          : undefined,
        budgetMinCents: data.budgetMinCents,
        budgetMaxCents: data.budgetMaxCents,
        preferredUnitType: data.preferredUnitType,
      },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.CREATE,
        entityType: "Lead",
        entityId: created.id,
        description: `Created lead ${created.email ?? created.id}`,
      }),
    });

    return NextResponse.json({ lead: created }, { status: 201 });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
