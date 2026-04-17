import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  tenantWhere,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { AuditAction, Prisma } from "@prisma/client";

const patchSchema = z.object({
  firstName: z.string().max(100).optional().nullable(),
  lastName: z.string().max(100).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  score: z.number().int().min(0).max(100).optional(),
  intent: z.enum(["hot", "warm", "cold"]).optional().nullable(),
  desiredMoveIn: z.string().datetime().optional().nullable(),
  budgetMinCents: z.number().int().nonnegative().optional().nullable(),
  budgetMaxCents: z.number().int().nonnegative().optional().nullable(),
  preferredUnitType: z.string().max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireScope();
    const { id } = await params;
    const lead = await prisma.lead.findFirst({
      where: { id, ...tenantWhere(scope) },
      include: {
        property: true,
        tours: { orderBy: { scheduledAt: "desc" } },
        applications: { orderBy: { createdAt: "desc" } },
        conversations: { orderBy: { lastMessageAt: "desc" }, take: 5 },
      },
    });
    if (!lead)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireScope();
    const { id } = await params;

    const existing = await prisma.lead.findFirst({
      where: { id, ...tenantWhere(scope) },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const update: Prisma.LeadUpdateInput = {
      lastActivityAt: new Date(),
      ...(d.firstName !== undefined ? { firstName: d.firstName } : {}),
      ...(d.lastName !== undefined ? { lastName: d.lastName } : {}),
      ...(d.email !== undefined ? { email: d.email } : {}),
      ...(d.phone !== undefined ? { phone: d.phone } : {}),
      ...(d.score !== undefined ? { score: d.score } : {}),
      ...(d.intent !== undefined ? { intent: d.intent } : {}),
      ...(d.desiredMoveIn !== undefined
        ? {
            desiredMoveIn: d.desiredMoveIn ? new Date(d.desiredMoveIn) : null,
          }
        : {}),
      ...(d.budgetMinCents !== undefined
        ? { budgetMinCents: d.budgetMinCents }
        : {}),
      ...(d.budgetMaxCents !== undefined
        ? { budgetMaxCents: d.budgetMaxCents }
        : {}),
      ...(d.preferredUnitType !== undefined
        ? { preferredUnitType: d.preferredUnitType }
        : {}),
      ...(d.notes !== undefined ? { notes: d.notes } : {}),
      ...(d.assignedToUserId !== undefined
        ? { assignedToUserId: d.assignedToUserId }
        : {}),
    };

    const updated = await prisma.lead.update({
      where: { id },
      data: update,
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "Lead",
        entityId: id,
        description: "Lead updated",
        diff: parsed.data as Prisma.InputJsonValue,
      }),
    });

    return NextResponse.json({ lead: updated });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
