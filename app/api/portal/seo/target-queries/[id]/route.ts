import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /api/portal/seo/target-queries/[id]
//
// PATCH  - toggle active / change intent
// DELETE - mark inactive (soft delete; preserves SerpRanking history)
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  active: z.boolean().optional(),
  intent: z
    .enum(["transactional", "local", "informational", "branded"])
    .nullable()
    .optional(),
});

async function loadOwned(id: string, scope: Awaited<ReturnType<typeof requireScope>>) {
  const where: Record<string, unknown> = { id, ...tenantWhere(scope) };
  const row = await prisma.seoTargetQuery.findFirst({
    where: where as never,
    select: { id: true, orgId: true, propertyId: true },
  });
  if (!row) return null;
  if (
    row.propertyId &&
    scope.allowedPropertyIds &&
    !scope.allowedPropertyIds.includes(row.propertyId)
  ) {
    return null;
  }
  return row;
}

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
  const row = await loadOwned(id, scope);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let parsed: z.infer<typeof patchSchema>;
  try {
    parsed = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updated = await prisma.seoTargetQuery.update({
    where: { id: row.id },
    data: {
      ...(parsed.active !== undefined ? { active: parsed.active } : {}),
      ...(parsed.intent !== undefined ? { intent: parsed.intent } : {}),
    },
  });

  return NextResponse.json({ ok: true, query: updated });
}

export async function DELETE(
  _req: NextRequest,
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
  const row = await loadOwned(id, scope);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft delete - keep historical rankings intact.
  await prisma.seoTargetQuery.update({
    where: { id: row.id },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}
