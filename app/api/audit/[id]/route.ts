import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProspectAuditStatus } from "@prisma/client";
import { healStalledProspectAudit } from "@/lib/audit/self-heal";

// GET /api/audit/[id]
// Public, unauthenticated. Used by the form page to poll the
// QUEUED → RUNNING → READY transition before redirecting the user to
// /audit/[token]. Intentionally lightweight — no findings/sectionScores
// returned here, those are rendered server-side on the viewer page
// (and gated behind email capture).
//
// Self-heal (2026-08-13, replaces the 2026-05-29 watchdog): a stalled
// QUEUED row means the start route's fire-and-forget trigger dropped —
// that's retryable, so we re-fire the trigger instead of failing the
// audit. A RUNNING row with no DB write for longer than the run route's
// maxDuration means the function died mid-scan — that one flips to
// FAILED. The old watchdog failed BOTH cases at 90s, which was shorter
// than the run route's 120s maxDuration — a normal 100s scan could be
// declared dead by a poll while it was still working.

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const audit = await prisma.prospectAudit.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      overallScore: true,
      shareToken: true,
      email: true,
      domain: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!audit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let status = audit.status;
  const action = await healStalledProspectAudit(audit);
  if (action === "fail") {
    status = ProspectAuditStatus.FAILED;
  }

  return NextResponse.json({
    id: audit.id,
    status,
    overallScore: audit.overallScore,
    shareToken: audit.shareToken,
    domain: audit.domain,
    hasEmail: Boolean(audit.email),
  });
}
