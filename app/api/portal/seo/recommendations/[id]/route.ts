import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { SeoActionStatus } from "@prisma/client";
import { invalidateRecommendationsCache } from "@/lib/seo/recommendation-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// PATCH /api/portal/seo/recommendations/[id]
//
// Operator flips a recommendation's status:
//   - OPEN → IN_PROGRESS  (no body needed)
//   - OPEN → COMPLETED    (body.completedBy optional, defaults to scope.userId)
//   - OPEN → DISMISSED    (body.reason required, 4+ chars)
//   - IN_PROGRESS → COMPLETED / DISMISSED
//
// Invalidates the per-property recommendation cache so the next read
// reflects the change without waiting for TTL.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED", "DISMISSED", "OPEN"]),
  reason: z.string().min(4).max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const { id } = await ctx.params;

  // Tenant-scoped read first so a malformed status / unknown id fails fast.
  const rec = await prisma.seoActionRecommendation.findFirst({
    where: { id, ...tenantWhere(scope) },
    select: { id: true, orgId: true, propertyId: true, status: true },
  });
  if (!rec) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (
    rec.propertyId &&
    scope.allowedPropertyIds &&
    !scope.allowedPropertyIds.includes(rec.propertyId)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.status === "DISMISSED" && !parsed.reason) {
    return NextResponse.json(
      { error: "Provide a reason when dismissing." },
      { status: 400 },
    );
  }

  const now = new Date();
  const data: Record<string, unknown> = {
    status: parsed.status as SeoActionStatus,
  };
  if (parsed.status === "COMPLETED") {
    data.completedAt = now;
    data.completedBy = scope.userId;
  }
  if (parsed.status === "DISMISSED") {
    data.dismissedAt = now;
    data.dismissedReason = parsed.reason;
  }
  if (parsed.status === "OPEN") {
    // Re-open: clear terminal columns.
    data.completedAt = null;
    data.completedBy = null;
    data.dismissedAt = null;
    data.dismissedReason = null;
  }

  const updated = await prisma.seoActionRecommendation.update({
    where: { id: rec.id },
    data,
  });

  // Bust the 1h cache so the next read on the property dashboard sees
  // the new status. Best-effort; cache failure shouldn't break the
  // status update.
  if (rec.propertyId) {
    await invalidateRecommendationsCache(rec.orgId, rec.propertyId).catch(
      () => undefined,
    );
  }

  return NextResponse.json({ ok: true, recommendation: updated });
}
