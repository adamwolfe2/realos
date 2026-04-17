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
  CreativeRequestStatus,
  Prisma,
} from "@prisma/client";

const schema = z.object({
  status: z.nativeEnum(CreativeRequestStatus),
  deliverableUrls: z.array(z.string().url()).max(20).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireScope();
    const { id } = await params;

    const current = await prisma.creativeRequest.findFirst({
      where: { id, ...tenantWhere(scope) },
      select: { id: true, status: true, revisionCount: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // DECISION: clients and agency impersonators share this endpoint. Only
    // agency side can DELIVER (upload deliverables). Clients can APPROVE
    // or REQUEST_REVISION.
    const agencyOnly: CreativeRequestStatus[] = [
      CreativeRequestStatus.IN_PROGRESS,
      CreativeRequestStatus.IN_REVIEW,
      CreativeRequestStatus.DELIVERED,
      CreativeRequestStatus.REJECTED,
    ];
    if (!scope.isAgency && agencyOnly.includes(data.status)) {
      return NextResponse.json(
        { error: "Only the agency can set this status." },
        { status: 403 }
      );
    }

    const update: Prisma.CreativeRequestUpdateInput = {
      status: data.status,
    };
    if (data.status === CreativeRequestStatus.DELIVERED) {
      update.deliveredAt = new Date();
      if (data.deliverableUrls && data.deliverableUrls.length > 0) {
        update.deliverableUrls =
          data.deliverableUrls as unknown as Prisma.InputJsonValue;
      }
    }
    if (data.status === CreativeRequestStatus.APPROVED) {
      update.approvedAt = new Date();
    }
    if (data.status === CreativeRequestStatus.REVISION_REQUESTED) {
      update.revisionCount = { increment: 1 };
    }

    await prisma.creativeRequest.update({
      where: { id },
      data: update,
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "CreativeRequest",
        entityId: id,
        description: `Creative request ${current.status} → ${data.status}`,
      }),
    });

    return NextResponse.json({ ok: true, status: data.status });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
