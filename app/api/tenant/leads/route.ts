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
  parsePropertyFilter,
  propertyWhereFragment,
} from "@/lib/tenancy/property-filter";
import {
  AuditAction,
  LeadSource,
  LeadStatus,
  Prisma,
  LeadNotifyChannel,
} from "@prisma/client";
import { notifyLeadCaptured } from "@/lib/notifications/lead-notify";

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

    // Apply property-level RBAC. The page UIs route every query through
    // propertyWhereFragment so a leasing agent with access to only Bldg
    // A can't see Bldg B leads in the table. Pre-fix the JSON API for
    // the same data was wide open: any tenant user could `fetch(/api/
    // tenant/leads)` and get the full org-wide list, bypassing the gate
    // the portal UI carefully applied. Now the API enforces the same
    // intersection (URL ?properties=… ∩ scope.allowedPropertyIds).
    const propertyIds = await parsePropertyFilter({
      properties: url.searchParams.get("properties") ?? undefined,
      property: url.searchParams.get("property") ?? undefined,
    });
    const where: Prisma.LeadWhereInput = {
      ...tenantWhere(scope),
      ...propertyWhereFragment(scope, propertyIds),
    };
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

    // If propertyId is passed, confirm it belongs to the tenant AND
    // that the caller has property-level access. Without the second
    // check a leasing agent restricted to one building could still
    // create leads scoped to a building they shouldn't see — and the
    // resulting Lead row would then surface back to them via the same
    // gate, but only after polluting the other property's pipeline.
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
      if (
        scope.allowedPropertyIds &&
        !scope.allowedPropertyIds.includes(data.propertyId)
      ) {
        return NextResponse.json(
          { error: "You do not have access to that property" },
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

    // Instant operator email — manual portal-added leads. Useful when an
    // admin enters a referral or walk-in so the building's leasing agent
    // sees it in their inbox without polling /portal/leads.
    void notifyLeadCaptured({
      orgId: scope.orgId,
      leadId: created.id,
      propertyId: created.propertyId,
      channel: LeadNotifyChannel.MANUAL,
      lead: {
        name:
          [data.firstName, data.lastName].filter(Boolean).join(" ") ||
          data.email ||
          null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        sourceLabel: data.sourceDetail ?? data.source,
        intent: data.notes ?? data.preferredUnitType ?? null,
      },
    }).catch(() => {});

    return NextResponse.json({ lead: created }, { status: 201 });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
