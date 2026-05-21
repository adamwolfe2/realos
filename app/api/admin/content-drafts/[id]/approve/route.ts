import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { DraftStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/admin/content-drafts/[id]/approve
//
// Admin signs off on a draft. Sets status APPROVED + reviewedAt + reviewedBy.
// Body optionally accepts `ship: true` to skip straight to SHIPPED (used
// when the admin pastes the content into the live site immediately after
// approving, e.g. for META_REWRITE / FAQ_BLOCK).
//
// Also closes out the linked SeoActionRecommendation (status COMPLETED).
// ---------------------------------------------------------------------------

const bodySchema = z
  .object({
    notes: z.string().max(2000).optional(),
    ship: z.boolean().optional(),
  })
  .optional();

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId, error } = await requireAdmin();
  if (error) return error;

  const { id } = await ctx.params;
  const draft = await prisma.contentDraft.findUnique({
    where: { id },
    select: { id: true, status: true, recommendationId: true },
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
        error: `Draft is ${draft.status}, can't approve from this state.`,
      },
      { status: 409 },
    );
  }

  let body: z.infer<typeof bodySchema> = {};
  try {
    body = bodySchema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const ship = body?.ship === true;
  const now = new Date();

  const updated = await prisma.contentDraft.update({
    where: { id: draft.id },
    data: {
      status: ship ? DraftStatus.SHIPPED : DraftStatus.APPROVED,
      reviewedAt: now,
      reviewedBy: userId,
      reviewNotes: body?.notes ?? null,
      ...(ship ? { shippedAt: now } : {}),
    },
  });

  // Close out the linked recommendation if any. Best-effort.
  if (draft.recommendationId) {
    await prisma.seoActionRecommendation
      .update({
        where: { id: draft.recommendationId },
        data: {
          status: "COMPLETED",
          completedAt: now,
          completedBy: userId,
        },
      })
      .catch(() => undefined);
  }

  return NextResponse.json({ ok: true, draft: updated });
}
