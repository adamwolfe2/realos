import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { DraftStatus } from "@prisma/client";
import { notifyDraftReviewed } from "@/lib/notifications/create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/admin/content-drafts/[id]/reject
//
// Admin rejects a draft. Two modes:
//   - mode: "reject"           -> terminal, status REJECTED
//   - mode: "request_changes"  -> non-terminal, status CHANGES_REQUESTED.
//                                 Operator can edit + re-submit.
//
// `notes` is required so the operator knows what to fix.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  notes: z.string().min(4).max(2000),
  mode: z.enum(["reject", "request_changes"]).default("request_changes"),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId, error } = await requireAdmin();
  if (error) return error;

  const { id } = await ctx.params;
  const draft = await prisma.contentDraft.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      orgId: true,
      format: true,
      property: { select: { name: true } },
    },
  });
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (
    draft.status !== DraftStatus.PENDING_REVIEW &&
    draft.status !== DraftStatus.CHANGES_REQUESTED
  ) {
    return NextResponse.json(
      {
        error: `Draft is ${draft.status}, can't review from this state.`,
      },
      { status: 409 },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Provide notes describing what to fix." },
      { status: 400 },
    );
  }

  const updated = await prisma.contentDraft.update({
    where: { id: draft.id },
    data: {
      status:
        parsed.mode === "reject"
          ? DraftStatus.REJECTED
          : DraftStatus.CHANGES_REQUESTED,
      reviewedAt: new Date(),
      reviewedBy: userId,
      reviewNotes: parsed.notes,
    },
  });
  // Fire-and-forget operator notification.
  void notifyDraftReviewed({
    orgId: draft.orgId,
    draftId: draft.id,
    status: parsed.mode === "reject" ? "REJECTED" : "CHANGES_REQUESTED",
    format: draft.format,
    propertyName: draft.property?.name ?? null,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, draft: updated });
}
