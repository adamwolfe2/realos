import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  tenantWhere,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { AuditAction, LeadStatus, Prisma } from "@prisma/client";

const body = z.object({ status: z.nativeEnum(LeadStatus) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireScope();
    const { id } = await params;

    const existing = await prisma.lead.findFirst({
      where: { id, ...tenantWhere(scope) },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (existing.status === parsed.data.status) {
      return NextResponse.json({ ok: true, noChange: true });
    }

    const update: Prisma.LeadUpdateInput = {
      status: parsed.data.status,
      lastActivityAt: new Date(),
    };
    if (parsed.data.status === LeadStatus.SIGNED) {
      update.convertedAt = new Date();
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: update,
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "Lead",
        entityId: id,
        description: `Lead status ${existing.status} → ${updated.status}`,
        diff: {
          status: { from: existing.status, to: updated.status },
        } as Prisma.InputJsonValue,
      }),
    });

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
