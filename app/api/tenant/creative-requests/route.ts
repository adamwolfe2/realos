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
  CreativeFormat,
  CreativeRequestStatus,
  Prisma,
} from "@prisma/client";
import { notifyNewIntake as notifySlack } from "@/lib/integrations/slack";

const create = z.object({
  propertyId: z.string().nullable().optional(),
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(5000),
  format: z.nativeEnum(CreativeFormat),
  targetDate: z.string().datetime().optional(),
  priority: z.string().max(40).optional(),
  referenceImageUrls: z.array(z.string().url()).max(20).optional(),
  brandAssetsUrls: z.array(z.string().url()).max(20).optional(),
  copyIdeas: z.string().max(3000).optional(),
  targetAudience: z.string().max(1000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const scope = await requireScope();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    const where: Prisma.CreativeRequestWhereInput = { ...tenantWhere(scope) };
    if (status && status in CreativeRequestStatus) {
      where.status = status as CreativeRequestStatus;
    }

    const rows = await prisma.creativeRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { property: { select: { id: true, name: true } } },
      take: 200,
    });
    return NextResponse.json({ rows });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = await requireScope();
    const parsed = create.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    if (data.propertyId) {
      const owned = await prisma.property.findFirst({
        where: { id: data.propertyId, ...tenantWhere(scope) },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json(
          { error: "Property not part of this tenant" },
          { status: 403 }
        );
      }
    }

    const created = await prisma.creativeRequest.create({
      data: {
        orgId: scope.orgId,
        propertyId: data.propertyId ?? null,
        requestedByUserId: scope.userId,
        title: data.title,
        description: data.description,
        format: data.format,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        priority: data.priority ?? "normal",
        referenceImageUrls: (data.referenceImageUrls ??
          []) as unknown as Prisma.InputJsonValue,
        brandAssetsUrls: (data.brandAssetsUrls ??
          []) as unknown as Prisma.InputJsonValue,
        copyIdeas: data.copyIdeas ?? null,
        targetAudience: data.targetAudience ?? null,
        messages: [] as unknown as Prisma.InputJsonValue,
        status: CreativeRequestStatus.SUBMITTED,
      },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.CREATE,
        entityType: "CreativeRequest",
        entityId: created.id,
        description: `Creative request "${created.title}" submitted`,
      }),
    });

    // Fire-and-forget Slack notification to #creative-requests.
    void notifySlack({
      companyName: scope.email,
      contactName: data.title,
      contactEmail: scope.email,
      propertyType: data.format,
      moduleCount: 0,
      intakeId: created.id,
    }).catch((err) => console.warn("[creative] slack error:", err));

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
