import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  publicApiLimiter,
  checkRateLimit,
  getIp,
} from "@/lib/rate-limit";
import { isPublicSiteKeyShape } from "@/lib/api-keys/public-site-key";
import {
  resolveOrgByPublicKey,
  upsertSession,
  recordEvent,
  recordIdentify,
  generateAnonymousId,
  normaliseEventType,
} from "@/lib/visitors/pixel-ingest";

// ---------------------------------------------------------------------------
// POST /api/public/visitors/track
//
// Public, cross-origin pixel ingest. Accepts a single event or a batch.
// Auth = public site key (`pk_site_*`) in the JSON body or `?k=`. Rate
// limited per IP and per key. Writes to VisitorSession + VisitorEvent
// scoped to the resolving tenant. Echoes back the (refreshed) session
// token + anonymousId so the snippet can persist them.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Pixel-Key",
  "Access-Control-Max-Age": "86400",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const eventSchema = z
  .object({
    type: z.string().max(40).optional(),
    url: z.string().url().max(2048).optional().nullable(),
    path: z.string().max(2048).optional().nullable(),
    title: z.string().max(500).optional().nullable(),
    referrer: z.string().max(2048).optional().nullable(),
    scrollDepth: z.number().min(0).max(100).optional().nullable(),
    timeOnPageSeconds: z.number().min(0).max(60 * 60 * 8).optional().nullable(),
    properties: z.record(z.string(), z.unknown()).optional().nullable(),
    occurredAt: z.string().datetime().optional(),
    // identify-only fields
    email: z.string().email().max(320).optional().nullable(),
    firstName: z.string().max(120).optional().nullable(),
    lastName: z.string().max(120).optional().nullable(),
    phone: z.string().max(40).optional().nullable(),
    traits: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .strict();

const bodySchema = z.object({
  publicKey: z.string().max(80).optional(),
  anonymousId: z.string().max(80).optional(),
  sessionToken: z.string().max(80).optional().nullable(),
  context: z
    .object({
      url: z.string().max(2048).optional().nullable(),
      referrer: z.string().max(2048).optional().nullable(),
      userAgent: z.string().max(1000).optional().nullable(),
      language: z.string().max(20).optional().nullable(),
      utm: z
        .object({
          source: z.string().max(200).optional().nullable(),
          medium: z.string().max(200).optional().nullable(),
          campaign: z.string().max(200).optional().nullable(),
          term: z.string().max(200).optional().nullable(),
          content: z.string().max(200).optional().nullable(),
        })
        .optional()
        .nullable(),
    })
    .optional(),
  events: z.array(eventSchema).max(50).optional(),
  // single-event shortcut
  event: eventSchema.optional(),
});

function jsonError(status: number, message: string) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: CORS_HEADERS }
  );
}

function pickPublicKey(req: NextRequest, body: { publicKey?: string }): string | null {
  const fromBody = body.publicKey?.trim();
  if (fromBody) return fromBody;
  const fromHeader =
    req.headers.get("x-pixel-key") ?? req.headers.get("X-Pixel-Key");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  const fromQuery = req.nextUrl.searchParams.get("k");
  if (fromQuery && fromQuery.trim()) return fromQuery.trim();
  return null;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed");
  }
  const data = parsed.data;

  const publicKey = pickPublicKey(req, data);
  if (!publicKey || !isPublicSiteKeyShape(publicKey)) {
    return jsonError(401, "Invalid or missing public site key");
  }

  const ip = getIp(req);
  const rate = await checkRateLimit(publicApiLimiter, `pixel:${publicKey}:${ip}`);
  if (!rate.allowed) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "Too many requests" }),
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "Retry-After": "30",
        },
      }
    );
  }

  const resolution = await resolveOrgByPublicKey(publicKey);
  if (!resolution) {
    return jsonError(404, "Unknown public site key");
  }

  const ctx = data.context ?? {};
  const userAgent =
    ctx.userAgent?.slice(0, 1000) ?? req.headers.get("user-agent");
  const events =
    data.events && data.events.length > 0
      ? data.events
      : data.event
      ? [data.event]
      : [];
  if (events.length === 0) {
    return jsonError(400, "No events in payload");
  }

  // Resolve / create the session once for the batch.
  const anonymousId = data.anonymousId?.trim() || generateAnonymousId();
  const session = await upsertSession({
    orgId: resolution.orgId,
    anonymousId,
    sessionToken: data.sessionToken ?? null,
    url: ctx.url ?? null,
    referrer: ctx.referrer ?? null,
    userAgent: userAgent ?? null,
    ipAddress: ip,
    language: ctx.language ?? null,
    utm: {
      source: ctx.utm?.source ?? null,
      medium: ctx.utm?.medium ?? null,
      campaign: ctx.utm?.campaign ?? null,
      term: ctx.utm?.term ?? null,
      content: ctx.utm?.content ?? null,
    },
  });

  let lastVisitorId = session.visitorId;
  let processed = 0;
  for (const ev of events) {
    const type = normaliseEventType(ev.type);
    const occurredAt = ev.occurredAt ? new Date(ev.occurredAt) : new Date();

    if (type === "identify") {
      await recordIdentify({
        orgId: resolution.orgId,
        visitorId: lastVisitorId,
        sessionId: session.sessionId,
        email: ev.email ?? null,
        firstName: ev.firstName ?? null,
        lastName: ev.lastName ?? null,
        phone: ev.phone ?? null,
        traits: ev.traits ?? null,
      });
    }

    await recordEvent({
      orgId: resolution.orgId,
      sessionId: session.sessionId,
      visitorId: lastVisitorId,
      type,
      url: ev.url ?? ctx.url ?? null,
      path: ev.path ?? null,
      title: ev.title ?? null,
      referrer: ev.referrer ?? ctx.referrer ?? null,
      scrollDepth: ev.scrollDepth ?? null,
      timeOnPageSeconds: ev.timeOnPageSeconds ?? null,
      properties: ev.properties ?? null,
      occurredAt,
    });

    processed += 1;
  }

  return NextResponse.json(
    {
      ok: true,
      sessionToken: session.sessionToken,
      anonymousId,
      processed,
      orgId: resolution.orgId,
      isNewSession: session.isNew,
    },
    { status: 200, headers: CORS_HEADERS }
  );
}
