import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PopupEventType, PopupStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordPopupEvent } from "@/lib/popups/queries";
import {
  popupEventLimiter,
  checkRateLimit,
  rateLimited,
  getIp,
  WIDGET_FALLBACK,
} from "@/lib/rate-limit";

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
  // Per-IP rate limit. Without this a competitor who scrapes the
  // victim's site once and learns the popupId can permanently inflate
  // the campaign's shownCount / convertedCount counters by hammering
  // the endpoint, ruining the operator's CTR/conversion attribution.
  // 60/min/IP is generous for legitimate embed traffic (a popup fires
  // at most once per pageview).
  const ip = getIp(req);
  const rl = await checkRateLimit(popupEventLimiter, ip, {
    softFallback: WIDGET_FALLBACK.popupEvent,
  });
  if (!rl.allowed) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((rl.reset - Date.now()) / 1000),
    );
    return rateLimited("Too many events", retryAfterSec, CORS_HEADERS);
  }

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

  // Per-session dedupe for SHOWN/DISMISSED events. The embed already
  // marks the popup with a frequency cap after a SHOWN event, but a
  // malicious caller can replay events from outside the embed. If the
  // same sessionId already has an event of the same non-CTA type
  // within the last 24 hours, treat it as a duplicate and quietly
  // accept without bumping counters. CTA_CLICKED + CONVERTED stay
  // unfiltered because legitimate users CAN click + convert multiple
  // times on a flow that re-shows the popup.
  if (
    parsed.data.sessionId &&
    (parsed.data.type === PopupEventType.SHOWN ||
      parsed.data.type === PopupEventType.DISMISSED)
  ) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await prisma.popupEvent.findFirst({
      where: {
        campaignId: popup.id,
        sessionId: parsed.data.sessionId,
        type: parsed.data.type,
        occurredAt: { gte: since },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { ok: true, recorded: false, dedup: true },
        { status: 200, headers: CORS_HEADERS },
      );
    }
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
