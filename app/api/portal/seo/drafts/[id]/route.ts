import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { DraftStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /api/portal/seo/drafts/[id]
//
// GET    - fetch a single draft (full output + markdown). Used by the
//          operator detail view and the polling indicator.
// PATCH  - edit brief / cancel a draft. Operators can't approve drafts
//          themselves — that flips to /api/admin/content-drafts/[id]/approve.
// DELETE - hard delete a draft (only allowed for non-shipped statuses).
// ---------------------------------------------------------------------------

const patchSchema = z
  .object({
    brief: z.string().min(8).max(2000).optional(),
    cancel: z.boolean().optional(),
  })
  .refine((v) => v.brief !== undefined || v.cancel !== undefined, {
    message: "Provide brief or cancel.",
  });

async function loadOwned(
  id: string,
  scope: Awaited<ReturnType<typeof requireScope>>,
) {
  const where: Record<string, unknown> = { id, ...tenantWhere(scope) };
  const row = await prisma.contentDraft.findFirst({
    where: where as never,
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

export async function GET(
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
  const draft = await loadOwned(id, scope);
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ draft });
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
  const draft = await loadOwned(id, scope);
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (draft.status === DraftStatus.APPROVED || draft.status === DraftStatus.SHIPPED) {
    return NextResponse.json(
      { error: "Cannot edit an approved or shipped draft." },
      { status: 409 },
    );
  }

  let parsed: z.infer<typeof patchSchema>;
  try {
    parsed = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updated = await prisma.contentDraft.update({
    where: { id: draft.id },
    data: {
      ...(parsed.brief !== undefined ? { brief: parsed.brief } : {}),
      ...(parsed.cancel
        ? { status: DraftStatus.EXPIRED, reviewedAt: new Date() }
        : {}),
    },
  });
  return NextResponse.json({ ok: true, draft: updated });
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
  const draft = await loadOwned(id, scope);
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (draft.status === DraftStatus.SHIPPED) {
    return NextResponse.json(
      { error: "Cannot delete a shipped draft." },
      { status: 409 },
    );
  }
  await prisma.contentDraft.delete({ where: { id: draft.id } });
  return NextResponse.json({ ok: true });
}
