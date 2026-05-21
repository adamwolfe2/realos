import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { DraftStatus } from "@prisma/client";
import { notifyDraftReviewed } from "@/lib/notifications/create";
import { sendDraftReviewEmail } from "@/lib/email/draft-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/admin/content-approvals/[id]/decide
//
// Single decision endpoint for the approvals queue. Replaces the older
// /approve + /reject split with one entrypoint so the UI doesn't have to
// know which route to call.
//
// Decisions:
//   APPROVED            -> reviewed, ready for admin to paste live.
//   CHANGES_REQUESTED   -> back to operator with notes. Re-submittable.
//   REJECTED            -> terminal kill. No re-submit.
//   SHIPPED             -> reviewed AND live on the client's site. Records
//                          shippedAt + reviewedBy. The optional `deployedUrl`
//                          is saved into the draft's `output` JSON so the
//                          team can trace it later.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED", "SHIPPED"]),
  notes: z.string().max(2000).optional(),
  deployedUrl: z.string().url().max(500).optional(),
});

const STATUS_BY_DECISION: Record<
  z.infer<typeof bodySchema>["decision"],
  DraftStatus
> = {
  APPROVED: DraftStatus.APPROVED,
  CHANGES_REQUESTED: DraftStatus.CHANGES_REQUESTED,
  REJECTED: DraftStatus.REJECTED,
  SHIPPED: DraftStatus.SHIPPED,
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId, error } = await requireAdmin();
  if (error) return error;

  const { id } = await ctx.params;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // CHANGES_REQUESTED and REJECTED both require notes — the operator needs
  // to know why. APPROVED + SHIPPED don't.
  if (
    (parsed.decision === "CHANGES_REQUESTED" || parsed.decision === "REJECTED") &&
    (!parsed.notes || parsed.notes.trim().length < 4)
  ) {
    return NextResponse.json(
      { error: "Provide notes describing what to fix." },
      { status: 400 },
    );
  }

  const draft = await prisma.contentDraft.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      orgId: true,
      format: true,
      output: true,
      recommendationId: true,
      property: { select: { name: true } },
    },
  });
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Allow any non-terminal state to flow. Block re-doing terminal states.
  const isTerminal =
    draft.status === DraftStatus.SHIPPED ||
    draft.status === DraftStatus.REJECTED;
  if (isTerminal) {
    return NextResponse.json(
      { error: `Draft is already ${draft.status}, can't change it.` },
      { status: 409 },
    );
  }

  const now = new Date();
  const nextStatus = STATUS_BY_DECISION[parsed.decision];

  // Merge deployedUrl into the existing structured output. We never overwrite
  // other keys — this is purely additive provenance.
  const existingOutput =
    draft.output && typeof draft.output === "object" && !Array.isArray(draft.output)
      ? (draft.output as Record<string, unknown>)
      : {};
  const nextOutput = parsed.deployedUrl
    ? {
        ...existingOutput,
        deployedUrl: parsed.deployedUrl,
        deployedAt: now.toISOString(),
        deployedBy: userId,
      }
    : existingOutput;

  const updated = await prisma.contentDraft.update({
    where: { id: draft.id },
    data: {
      status: nextStatus,
      reviewedAt: now,
      reviewedBy: userId,
      ...(parsed.notes !== undefined ? { reviewNotes: parsed.notes } : {}),
      ...(parsed.decision === "SHIPPED" ? { shippedAt: now } : {}),
      ...(parsed.deployedUrl ? { output: nextOutput as never } : {}),
    },
  });

  // Audit trail.
  await prisma.auditEvent
    .create({
      data: {
        orgId: draft.orgId,
        userId,
        action: "UPDATE",
        entityType: "ContentDraft",
        entityId: draft.id,
        description: `${parsed.decision}${
          parsed.notes ? ` · ${parsed.notes.slice(0, 120)}` : ""
        }${parsed.deployedUrl ? ` · ${parsed.deployedUrl}` : ""}`,
        diff: {
          from: draft.status,
          to: nextStatus,
          notes: parsed.notes ?? null,
          deployedUrl: parsed.deployedUrl ?? null,
        } as never,
      },
    })
    .catch(() => undefined);

  // Close out any linked recommendation on terminal-success states.
  if (
    draft.recommendationId &&
    (parsed.decision === "APPROVED" || parsed.decision === "SHIPPED")
  ) {
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

  // Operator-facing notifications. Fire-and-forget so a downstream Resend
  // hiccup doesn't fail the API call.
  void notifyDraftReviewed({
    orgId: draft.orgId,
    draftId: draft.id,
    status: parsed.decision,
    format: draft.format,
    propertyName: draft.property?.name ?? null,
  }).catch(() => undefined);
  void sendDraftReviewEmail({
    orgId: draft.orgId,
    draftId: draft.id,
    status: parsed.decision,
    format: draft.format,
    propertyName: draft.property?.name ?? null,
    reviewNotes: updated.reviewNotes,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, draft: updated });
}
