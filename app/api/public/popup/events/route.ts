import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PopupEventType, PopupStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordPopupEvent } from "@/lib/popups/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/public/popup/events
//
// Public endpoint hit by /embed/popup.js to record:
//   - SHOWN: popup rendered to the visitor
//   - DISMISSED: visitor closed the popup
//   - CTA_CLICKED: visitor clicked the primary CTA
//   - CONVERTED: visitor submitted the capture form (a Lead row is
//     created in /api/public/leads via a separate call; this event
//     just records that the conversion happened so the popup's
//     attribution counter increments)
//
// CORS: wide open (same shape as /config). The event creates a row
// scoped to the popup's org, which is resolved server-side from the
// popup id rather than trusted from the client payload. Cap the
// per-IP rate via Vercel firewall — no in-process limiter here
// because this fires from arbitrary third-party sites.
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const bodySchema = z.object({
  popupId: z.string().min(1).max(40),
  type: z.nativeEnum(PopupEventType),
  sessionId: z.string().max(80).optional(),
  anonymousId: z.string().max(80).optional(),
  leadId: z.string().max(40).optional(),
  pageUrl: z.string().max(2000).optional(),
  referrer: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = bodySchema.safeParse(await req.json());
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Resolve the popup's org server-side. We do NOT trust an orgId
  // from the client — the embed never sends one. Drop unknown popup
  // ids silently so a stale snippet on a deleted campaign quietly
  // no-ops instead of revealing existence via different HTTP codes.
  const popup = await prisma.popupCampaign.findUnique({
    where: { id: parsed.data.popupId },
    select: { id: true, orgId: true, status: true },
  });
  if (!popup) {
    return NextResponse.json(
      { ok: true, recorded: false },
      { status: 200, headers: CORS_HEADERS },
    );
  }

  // Only count events on currently-active popups. A paused/archived
  // campaign that's still in someone's browser cache should not
  // accumulate noise after the operator paused it.
  if (popup.status !== PopupStatus.ACTIVE) {
    return NextResponse.json(
      { ok: true, recorded: false },
      { status: 200, headers: CORS_HEADERS },
    );
  }

  await recordPopupEvent({
    orgId: popup.orgId,
    campaignId: popup.id,
    type: parsed.data.type,
    sessionId: parsed.data.sessionId,
    anonymousId: parsed.data.anonymousId,
    leadId: parsed.data.leadId,
    pageUrl: parsed.data.pageUrl,
    referrer: parsed.data.referrer,
  });

  return NextResponse.json(
    { ok: true, recorded: true },
    { status: 200, headers: CORS_HEADERS },
  );
}
