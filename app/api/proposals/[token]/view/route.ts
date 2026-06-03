import { NextResponse, type NextRequest } from "next/server";
import { ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveLiveShareToken } from "@/lib/proposals/share-token";
import {
  checkRateLimit,
  getIp,
  proposalViewLimiter,
  rateLimited,
} from "@/lib/rate-limit";
import { captureWithContext } from "@/lib/sentry";

// ---------------------------------------------------------------------------
// Public view-tracker for /proposal/[token].
//
// Called from the small <ViewPing> client component on the share page. The
// goal is a single counted view per real page load + a SENT→VIEWED status
// transition the first time the prospect opens the link.
//
// Anti-enumeration: every not-found / revoked / expired path collapses to
// the same 404 response. Never distinguish; resolveLiveShareToken already
// returns null for all three.
//
// Anti-DoS: 30/min/IP. A scripted refresh loop hitting one token would
// otherwise inflate viewCount and burn DB row-level locks on a single
// proposal forever.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(
    proposalViewLimiter,
    `proposal-view:${ip}`,
  );
  if (!allowed) {
    return rateLimited("Rate limit exceeded", 60) as NextResponse;
  }

  try {
    const { token } = await params;
    const resolved = await resolveLiveShareToken(token);
    if (!resolved) {
      // Anti-enumeration: same 404 for not-found / revoked / expired.
      return new NextResponse(null, { status: 404 });
    }

    // Read the minimum we need to decide whether to bump firstViewedAt +
    // status. Doing it as a single update would lose the "first view"
    // distinction since `update` cannot reference the current row in
    // an expression without raw SQL on Prisma.
    const proposal = await prisma.proposal.findUnique({
      where: { id: resolved.proposalId },
      select: {
        id: true,
        status: true,
        firstViewedAt: true,
      },
    });
    if (!proposal) {
      // Token resolved but proposal row gone — treat as 404 (no oracle).
      return new NextResponse(null, { status: 404 });
    }

    const now = new Date();
    const isFirstView = proposal.firstViewedAt == null;
    const shouldTransitionStatus = proposal.status === ProposalStatus.SENT;

    await prisma.proposal.update({
      where: { id: proposal.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: now,
        ...(isFirstView ? { firstViewedAt: now } : {}),
        ...(shouldTransitionStatus
          ? { status: ProposalStatus.VIEWED }
          : {}),
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    captureWithContext(err, {
      route: "api/proposals/[token]/view",
    });
    // Same 404 surface on internal error so a clever caller can't probe
    // the difference between "bad token" and "DB hiccup".
    return new NextResponse(null, { status: 404 });
  }
}
