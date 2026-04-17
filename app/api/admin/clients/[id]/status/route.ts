import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAgency,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { AuditAction, OrgType, TenantStatus, Prisma } from "@prisma/client";

const body = z.object({
  status: z.nativeEnum(TenantStatus),
  atRiskReason: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let scope;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      orgType: true,
      status: true,
      atRiskReason: true,
      launchedAt: true,
    },
  });
  if (!existing || existing.orgType !== OrgType.CLIENT) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.status === parsed.data.status) {
    return NextResponse.json({ ok: true, noChange: true });
  }

  const update: Prisma.OrganizationUpdateInput = {
    status: parsed.data.status,
    atRiskReason:
      parsed.data.status === TenantStatus.AT_RISK
        ? parsed.data.atRiskReason ?? existing.atRiskReason ?? null
        : null,
  };
  if (
    parsed.data.status === TenantStatus.LAUNCHED &&
    !existing.launchedAt
  ) {
    update.launchedAt = new Date();
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: update,
  });

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId: id } as typeof scope,
      {
        action: AuditAction.UPDATE,
        entityType: "Organization",
        entityId: id,
        description: `Pipeline status: ${existing.status} → ${updated.status}`,
        diff: {
          status: { from: existing.status, to: updated.status },
        } as Prisma.InputJsonValue,
      }
    ),
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
