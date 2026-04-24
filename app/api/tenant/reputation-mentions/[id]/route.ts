import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import {
  checkRateLimit,
  clientWriteLimiter,
  rateLimited,
} from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// PATCH /api/tenant/reputation-mentions/[id]
//
// Toggle the `reviewed` / `flagged` flags on a single mention. Both are
// team-wide (not per-user); we record which user last updated via
// `reviewedByUserId` for audit context.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    reviewed: z.boolean().optional(),
    flagged: z.boolean().optional(),
  })
  .refine((v) => v.reviewed !== undefined || v.flagged !== undefined, {
    message: "At least one of {reviewed, flagged} must be provided",
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let scope: Awaited<ReturnType<typeof requireScope>>;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    clientWriteLimiter,
    `reputation-mentions-write:${scope.userId}`
  );
  if (!allowed) return rateLimited();

  const { id } = await params;

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify tenant ownership before write.
  const existing = await prisma.propertyMention.findFirst({
    where: { id, ...tenantWhere(scope) },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Mention not found" }, { status: 404 });
  }

  const data: {
    reviewedByUserId?: string | null;
    flagged?: boolean;
  } = {};
  if (parsed.data.reviewed !== undefined) {
    data.reviewedByUserId = parsed.data.reviewed ? scope.userId : null;
  }
  if (parsed.data.flagged !== undefined) {
    data.flagged = parsed.data.flagged;
  }

  const updated = await prisma.propertyMention.update({
    where: { id },
    data,
    select: {
      id: true,
      reviewedByUserId: true,
      flagged: true,
    },
  });

  return NextResponse.json({
    id: updated.id,
    reviewed: updated.reviewedByUserId !== null,
    flagged: updated.flagged,
  });
}
