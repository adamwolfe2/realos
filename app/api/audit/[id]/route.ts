import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProspectAuditStatus } from "@prisma/client";

// GET /api/audit/[id]
// Public, unauthenticated. Used by the form page to poll the
// QUEUED → RUNNING → READY transition before redirecting the user to
// /audit/[token]. Intentionally lightweight — no findings/sectionScores
// returned here, those are rendered server-side on the viewer page
// (and gated behind email capture).
//
// Watchdog (2026-05-29): when the /api/audit/run/[id] function exceeds
// Vercel's `maxDuration` cap, the platform kills the process before our
// catch block can flip the row to FAILED. The row stays in RUNNING
// forever and the front-end polls a status that'll never change. To
// break that loop, this status check force-flips any RUNNING row older
// than RUNNING_WATCHDOG_MS to FAILED so the form gets a definitive
// answer instead of spinning until the user gives up.

// How long a RUNNING row can stay "RUNNING" before we conclude the
// background function died on us. Comfortably longer than the run
// route's maxDuration so a normal long scan still completes; tight
// enough that a hung scan surfaces inside the form's own 90s timeout.
const RUNNING_WATCHDOG_MS = 90_000;

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
    },
  });
  if (!audit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Watchdog: if the row has been RUNNING (or QUEUED) for more than
  // RUNNING_WATCHDOG_MS, treat it as a function-timeout failure and
  // flip to FAILED so the poll loop on the form gets a definitive
  // signal. Idempotent — additional polls after the flip just return
  // FAILED without touching the row again.
  let status = audit.status;
  if (
    (status === ProspectAuditStatus.QUEUED ||
      status === ProspectAuditStatus.RUNNING) &&
    Date.now() - audit.createdAt.getTime() > RUNNING_WATCHDOG_MS
  ) {
    await prisma.prospectAudit
      .update({
        where: { id: audit.id, status }, // Optimistic guard: only flip if still in the same state
        data: {
          status: ProspectAuditStatus.FAILED,
          errorMessage:
            "Scan exceeded the function timeout. The pipeline likely took longer than maxDuration allows; bump it or trim the fan-out.",
        },
      })
      .catch(() => {
        // Someone else flipped it concurrently — the next poll will
        // pick up the real terminal state.
      });
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
