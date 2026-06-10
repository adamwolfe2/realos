import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireWritableWorkspace,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { AuditAction } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// PATCH /api/portal/properties/[id]/hero-image-transform
//
// Saves the operator-curated drag/zoom transform for a property's hero
// image. Three values:
//   offsetX   -100..100 (percentage of image container width)
//   offsetY   -100..100 (percentage of image container height)
//   scale     0.5..3.0  (multiplier; 1 = native fit)
//
// Bounds are deliberate: the UI clamps drags so the image can't be
// shoved off-screen entirely. We also clamp here as a defense-in-depth
// in case a client sends a wild value.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  offsetX: z.number().finite(),
  offsetY: z.number().finite(),
  scale: z.number().finite(),
});

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let scope;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const { id } = await ctx.params;
  if (scope.allowedPropertyIds && !scope.allowedPropertyIds.includes(id)) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const property = await prisma.property.findFirst({
    where: { id, ...tenantWhere(scope) },
    select: { id: true, name: true },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const offsetX = clamp(parsed.offsetX, -100, 100);
  const offsetY = clamp(parsed.offsetY, -100, 100);
  const scale = clamp(parsed.scale, 0.5, 3);

  await prisma.property.update({
    where: { id: property.id },
    data: {
      heroImageOffsetX: offsetX,
      heroImageOffsetY: offsetY,
      heroImageScale: scale,
    },
  });

  await prisma.auditEvent
    .create({
      data: {
        orgId: scope.orgId,
        userId: scope.userId,
        action: AuditAction.SETTING_CHANGE,
        entityType: "Property",
        entityId: property.id,
        description: `Hero image transform saved for ${property.name}`,
        diff: { offsetX, offsetY, scale },
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true, offsetX, offsetY, scale });
}
