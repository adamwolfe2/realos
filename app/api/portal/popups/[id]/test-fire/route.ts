import { NextRequest, NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/portal/popups/[id]/test-fire
//
// Operator-initiated synthetic SHOWN event. Lets a tenant verify the
// full event pipeline (PopupCampaign → PopupEvent → /recent-events
// feed → dashboard analytics) without having to embed the snippet on
// a live site or wait for a real visitor.
//
// The synthetic event is tagged with `sessionId: "operator-test-..."`
// so analytics queries that want to exclude operator probes can
// filter on the prefix. It is NOT included in shownCount /
// dismissedCount denormalized counters on PopupCampaign — those
// counters are reserved for real visitor traffic.
//
// Returns the created PopupEvent so the calling client can show
// immediate confirmation ("Test fired at 12:34:56 — appearing in
// Live activity below").
// ---------------------------------------------------------------------------

export async function POST(
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

  // Verify ownership — same pattern as the recent-events route.
  const campaign = await prisma.popupCampaign.findFirst({
    where: { id, orgId: scope.orgId },
    select: { id: true, headline: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Synthetic session ID with `operator-test-` prefix so dashboards
  // that want to exclude these probes can filter on the prefix
  // (currently they don't — included in headline analytics — but the
  // tagging is forward-compatible for a future filter).
  const sessionId =
    "operator-test-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  const event = await prisma.popupEvent.create({
    data: {
      orgId: scope.orgId,
      campaignId: id,
      type: "SHOWN",
      sessionId,
      pageUrl: "[portal-test-fire]",
      referrer: null,
    },
    select: {
      id: true,
      type: true,
      pageUrl: true,
      sessionId: true,
      occurredAt: true,
    },
  });

  return NextResponse.json({ ok: true, event });
}
