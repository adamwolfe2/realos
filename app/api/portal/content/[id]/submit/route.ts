import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireWritableWorkspace,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { DraftStatus } from "@prisma/client";
import { sendDraftSubmittedEmail } from "@/lib/email/draft-submitted";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/portal/content/[id]/submit
//
// Flips a draft from any editable state (GENERATING / CHANGES_REQUESTED /
// PENDING_REVIEW) to PENDING_REVIEW, records submittedAt, and emails the
// agency owner via the existing draft-submitted Resend template. The
// editor calls this when the operator clicks "Submit for approval".
//
// Idempotent: re-submitting a PENDING_REVIEW draft just refreshes
// submittedAt and re-sends the email so reviewers see the new version.
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: RouteContext) {
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

  const draft = await prisma.contentDraft.findFirst({
    where: { id, ...tenantWhere<{ orgId?: string }>(scope) } as never,
    select: {
      id: true,
      orgId: true,
      propertyId: true,
      format: true,
      brief: true,
      targetQuery: true,
      status: true,
      estimatedScore: true,
      property: { select: { name: true } },
      org: { select: { name: true } },
    },
  });
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (
    scope.allowedPropertyIds &&
    draft.propertyId &&
    !scope.allowedPropertyIds.includes(draft.propertyId)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Block re-submission on terminal states. Approved drafts go straight
  // to ship; rejected/shipped/expired drafts can't be re-opened from
  // the operator side.
  if (
    draft.status === DraftStatus.APPROVED ||
    draft.status === DraftStatus.SHIPPED ||
    draft.status === DraftStatus.EXPIRED ||
    draft.status === DraftStatus.REJECTED
  ) {
    return NextResponse.json(
      {
        error: `Draft is ${draft.status.toLowerCase()} and cannot be submitted.`,
      },
      { status: 409 },
    );
  }

  const now = new Date();
  await prisma.contentDraft.update({
    where: { id: draft.id },
    data: {
      status: DraftStatus.PENDING_REVIEW,
      submittedAt: now,
    },
  });

  // Fire-and-forget email to the agency reviewer. Matches the pattern
  // used by /api/portal/seo/drafts on first generation so we don't
  // double-implement the transactional path.
  void sendDraftSubmittedEmail({
    draftId: draft.id,
    format: draft.format,
    brief: draft.brief,
    targetQuery: draft.targetQuery,
    estimatedScore: draft.estimatedScore,
    clientOrgName: draft.org?.name ?? "Client",
    propertyName: draft.property?.name ?? null,
  }).catch((err) => {
    console.error("[content-submit] email failed", err);
  });

  return NextResponse.json({ ok: true });
}
