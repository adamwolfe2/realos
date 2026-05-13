import { NextRequest, NextResponse } from "next/server";
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

// POST /api/webhooks/cursive/[token]
//
// Per-tenant webhook receiver where the URL path is the secret. Used by
// AudienceLab's "Pixel → Webhooks" UI, which fires outbound webhooks
// without giving the user a custom-headers tab. The shared
// /api/webhooks/cursive endpoint requires our x-audiencelab-secret header,
// so AL's pixel UI cannot pass its built-in Test button there.
//
// 32 hex chars = 128 bits of entropy is plenty for an opaque tenant token
// behind TLS. We mint one per CursiveIntegration when ops first saves a
// pixel_id; the URL it produces goes into the AL pixel's webhook field.
//
// No header auth is performed: the path token IS the auth.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 3 * 1024 * 1024;
const TOKEN_RE = /^[a-f0-9]{32}$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(
    webhookLimiter,
    `wh-cursive-token:${ip}`,
  );
  if (!allowed) {
    return rateLimited("Rate limit exceeded", 60);
  }

  const { token } = await params;
  // Validate format before any DB work so probe-by-random-string attacks
  // can't burn lookups. Real tokens are minted as 32-char lowercase hex.
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const integration = await prisma.cursiveIntegration.findUnique({
    where: { webhookToken: token },
    select: {
      orgId: true,
      cursivePixelId: true,
      installedOnDomain: true,
    },
  });
  if (!integration) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Body too large" }, { status: 413 });
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

  // Whole-body dedupe envelope. Same as the shared route — a byte-identical
  // retry from AL hits the unique bodyHash constraint and short-circuits.
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
        orgId: integration.orgId,
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
      results.push(await processCursiveEvent(ev, integration));
    }
    await prisma.webhookEvent.update({
      where: { id: envelope.id },
      data: { status: "processed" },
    });

    // On-data-arrival insight pass — the first Cursive pixel event for an
    // org is a high-signal moment (their pixel just went live). Detectors
    // like hot-visitor + traffic-source-by-intent fire immediately so the
    // user sees insights tied to their just-installed pixel.
    try {
      const { triggerInsightsForOrg } = await import(
        "@/lib/insights/triggers"
      );
      triggerInsightsForOrg(integration.orgId, "cursive_event");
    } catch (err) {
      console.warn("[cursive] failed to trigger insights", err);
    }

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
