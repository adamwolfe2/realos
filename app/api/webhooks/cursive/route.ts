import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import {
  webhookLimiter,
  checkRateLimit,
  getIp,
  rateLimited,
} from "@/lib/rate-limit";
import {
  isUniqueConstraintError,
  processCursiveEvent,
  sha256,
  unwrapEvents,
} from "@/lib/webhooks/cursive-process";

// POST /api/webhooks/cursive
//
// AudienceLab SuperPixel webhook receiver, shared-secret variant. Used by
// the Studio "Segment Trigger" workflow which exposes a custom-headers tab
// and includes our x-audiencelab-secret on every call. The per-pixel
// webhook UI in AL does not include that header — those tenants point at
// /api/webhooks/cursive/[token] instead, where the URL itself is the secret.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 3 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(webhookLimiter, `wh-cursive:${ip}`);
  if (!allowed) {
    return rateLimited("Rate limit exceeded", 60);
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Body too large" }, { status: 413 });
  }

  const secret = process.env.CURSIVE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const sharedSecret = req.headers.get("x-audiencelab-secret");
  const signature =
    req.headers.get("x-audiencelab-signature") ??
    req.headers.get("x-webhook-signature");
  if (!verifyAuth({ rawBody, secret, sharedSecret, signature })) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = unwrapEvents(parsed);
  if (events.length === 0) {
    return NextResponse.json({ error: "No events" }, { status: 400 });
  }

  const bodyHash = sha256(rawBody);
  let envelope;
  try {
    envelope = await prisma.webhookEvent.create({
      data: {
        source: "cursive",
        bodyHash,
        eventType: null,
        status: "received",
        attempts: 1,
        lastAttemptAt: new Date(),
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  try {
    const results = [];
    for (const ev of events) {
      results.push(await processCursiveEvent(ev));
    }
    await prisma.webhookEvent.update({
      where: { id: envelope.id },
      data: { status: "processed" },
    });
    return NextResponse.json({
      ok: true,
      events: events.length,
      processed: results,
    });
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: envelope.id },
      data: {
        status: "failed",
        processingError:
          err instanceof Error ? err.message.slice(0, 2000) : String(err),
        rawBody,
        nextRetryAt: new Date(Date.now() + 60_000),
      },
    });
    return NextResponse.json(
      { ok: false, error: "Processing failed, queued for retry." },
      { status: 500 },
    );
  }
}

function verifyAuth(args: {
  rawBody: string;
  secret: string;
  sharedSecret: string | null;
  signature: string | null;
}): boolean {
  if (args.sharedSecret) {
    return timingSafeEquals(args.sharedSecret, args.secret);
  }
  if (args.signature) {
    const expected = crypto
      .createHmac("sha256", args.secret)
      .update(args.rawBody)
      .digest("hex");
    const presented = args.signature.startsWith("sha256=")
      ? args.signature.slice("sha256=".length)
      : args.signature;
    return timingSafeEquals(presented, expected);
  }
  return false;
}

function timingSafeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}
