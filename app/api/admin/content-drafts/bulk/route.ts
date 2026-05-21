import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { DraftStatus } from "@prisma/client";
import { notifyDraftReviewed } from "@/lib/notifications/create";
import { sendDraftReviewEmail } from "@/lib/email/draft-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Bulk path may fire 20+ emails + notifications + DB writes.
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST /api/admin/content-drafts/bulk
//
// Apply a single action to multiple drafts at once. Used by the queue
// page when an admin selects multiple rows and hits "Approve selected"
// or "Reject selected." Cap at 50 ids per call to keep wall-time bounded.
//
// Body:
//   { ids: string[], action: "approve" | "ship" | "reject" | "request_changes",
//     notes?: string  // required for reject + request_changes }
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
  action: z.enum(["approve", "ship", "reject", "request_changes"]),
  notes: z.string().min(4).max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const { userId, error } = await requireAdmin();
  if (error) return error;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (
    (parsed.action === "reject" || parsed.action === "request_changes") &&
    !parsed.notes
  ) {
    return NextResponse.json(
      { error: "Notes are required for reject and request_changes." },
      { status: 400 },
    );
  }

  // Fetch only drafts that are in a reviewable state. Anything already
  // terminal (APPROVED / SHIPPED / REJECTED) is skipped silently.
  const drafts = await prisma.contentDraft.findMany({
    where: {
      id: { in: parsed.ids },
      status: {
        in: [DraftStatus.PENDING_REVIEW, DraftStatus.CHANGES_REQUESTED],
      },
    },
    select: {
      id: true,
      orgId: true,
      format: true,
      recommendationId: true,
      property: { select: { name: true } },
    },
  });

  if (drafts.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        updated: 0,
        skipped: parsed.ids.length,
        reason:
          "No reviewable drafts in the provided ids (already approved, shipped, or rejected).",
      },
      { status: 200 },
    );
  }

  const now = new Date();
  let nextStatus: DraftStatus;
  let extra: Record<string, unknown> = {};
  if (parsed.action === "approve") {
    nextStatus = DraftStatus.APPROVED;
  } else if (parsed.action === "ship") {
    nextStatus = DraftStatus.SHIPPED;
    extra = { shippedAt: now };
  } else if (parsed.action === "request_changes") {
    nextStatus = DraftStatus.CHANGES_REQUESTED;
  } else {
    nextStatus = DraftStatus.REJECTED;
  }

  const updateMany = await prisma.contentDraft.updateMany({
    where: { id: { in: drafts.map((d) => d.id) } },
    data: {
      status: nextStatus,
      reviewedAt: now,
      reviewedBy: userId,
      ...(parsed.notes !== undefined ? { reviewNotes: parsed.notes } : {}),
      ...extra,
    },
  });

  // Close out linked recommendations for approved + shipped batches.
  if (parsed.action === "approve" || parsed.action === "ship") {
    const recIds = drafts
      .map((d) => d.recommendationId)
      .filter((id): id is string => !!id);
    if (recIds.length > 0) {
      await prisma.seoActionRecommendation
        .updateMany({
          where: { id: { in: recIds } },
          data: {
            status: "COMPLETED",
            completedAt: now,
            completedBy: userId,
          },
        })
        .catch(() => undefined);
    }
  }

  // Fire-and-forget bell + email notifications for every updated row.
  // Cap concurrency naturally — Promise.allSettled fires them all at
  // once, which is fine for 50 rows at email-API throughput.
  const notifyStatus =
    parsed.action === "approve"
      ? ("APPROVED" as const)
      : parsed.action === "ship"
        ? ("SHIPPED" as const)
        : parsed.action === "request_changes"
          ? ("CHANGES_REQUESTED" as const)
          : ("REJECTED" as const);
  void Promise.allSettled(
    drafts.map((d) =>
      Promise.allSettled([
        notifyDraftReviewed({
          orgId: d.orgId,
          draftId: d.id,
          status: notifyStatus,
          format: d.format,
          propertyName: d.property?.name ?? null,
        }),
        sendDraftReviewEmail({
          orgId: d.orgId,
          draftId: d.id,
          status: notifyStatus,
          format: d.format,
          propertyName: d.property?.name ?? null,
          reviewNotes: parsed.notes ?? null,
        }),
      ]),
    ),
  ).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    updated: updateMany.count,
    skipped: parsed.ids.length - updateMany.count,
  });
}
