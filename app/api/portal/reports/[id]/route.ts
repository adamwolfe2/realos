import { NextRequest, NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// PATCH /api/portal/reports/[id]
// Body: { headline?, notes?, status? }
// Updates operator-editable fields. Flipping status to "shared" stamps
// sharedAt the first time.
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireScope();
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    const existing = await prisma.clientReport.findFirst({
      where: { id, orgId: scope.orgId },
      select: { id: true, sharedAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.headline === "string" || body.headline === null) {
      data.headline = body.headline;
    }
    if (typeof body.notes === "string" || body.notes === null) {
      data.notes = body.notes;
    }
    if (
      body.status === "draft" ||
      body.status === "shared" ||
      body.status === "archived"
    ) {
      data.status = body.status;
      if (body.status === "shared" && !existing.sharedAt) {
        data.sharedAt = new Date();
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No updatable fields supplied" }, { status: 400 });
    }

    const updated = await prisma.clientReport.update({
      where: { id },
      data,
      select: {
        id: true,
        headline: true,
        notes: true,
        status: true,
        sharedAt: true,
        shareToken: true,
      },
    });

    return NextResponse.json({ report: updated });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/portal/reports/[id]
// Soft delete: flips status to "archived". Keeps the row for history.
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireScope();
    const { id } = await context.params;

    const result = await prisma.clientReport.updateMany({
      where: { id, orgId: scope.orgId },
      data: { status: "archived" },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
