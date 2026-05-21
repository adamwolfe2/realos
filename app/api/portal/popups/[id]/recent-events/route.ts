import { NextRequest, NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/portal/popups/[id]/recent-events
//
// Returns the most recent PopupEvent rows for a campaign, scoped to the
// requesting operator's org. Powers the "Live activity" feed in the
// campaign editor — operator opens this page in one tab, hits their
// website (or ?lspopup=preview link) in another, and sees SHOWN /
// DISMISSED / CTA_CLICKED events arrive in near real-time.
//
// Polled every ~3s by the client component. Hard caps to keep the
// payload small and the query cheap:
//   - last 50 events max
//   - last 30 minutes only (operator-test sessions usually finish in
//     <5min; we keep a 30-min window to cover demo + Q&A)
//   - only the columns the feed renders (no full row dump)
// ---------------------------------------------------------------------------

const WINDOW_MS = 30 * 60 * 1000;
const EVENT_LIMIT = 50;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  // Verify the campaign belongs to this org BEFORE the events query so a
  // 404 leaks no event data on a wrong-org request. Cheap PK lookup.
  const campaign = await prisma.popupCampaign.findFirst({
    where: { id, orgId: scope.orgId },
    select: { id: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const since = new Date(Date.now() - WINDOW_MS);
  const events = await prisma.popupEvent.findMany({
    where: { campaignId: id, orgId: scope.orgId, occurredAt: { gt: since } },
    orderBy: { occurredAt: "desc" },
    take: EVENT_LIMIT,
    select: {
      id: true,
      type: true,
      pageUrl: true,
      referrer: true,
      sessionId: true,
      occurredAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    events,
    windowMs: WINDOW_MS,
    serverTime: new Date().toISOString(),
  });
}
