import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  webhookLimiter,
  checkRateLimit,
  getIp,
  rateLimited,
} from "@/lib/rate-limit";
import {
  CAL_TOKEN_RE,
  processCalBooking,
  type CalPayload,
} from "@/lib/integrations/cal-webhook";

// ---------------------------------------------------------------------------
// POST /api/webhooks/cal/[token]
//
// Per-tenant Cal.com webhook receiver. An operator pastes
// https://www.leasestack.co/api/webhooks/cal/<their-token> (minted + shown on
// the Integrations page) into the "Subscriber URL" of any Cal.com webhook.
// When a prospect books, Cal POSTs here, we resolve the org FROM THE TOKEN
// (never from a client-supplied id), upsert a Lead by email, and create a Tour
// scoped to that org's default property.
//
// AUTH MODEL (P0-2): the token path segment is the secret — an unguessable
// 32-char hex string stored on Organization.calWebhookToken, never exposed on
// any public surface. This replaces the prior orgId-in-path design, whose
// "secret" (the org cuid) was leaked by the public chatbot config endpoint and
// allowed cross-tenant booking injection. Combined with the per-IP rate limit
// and strict format check, the surface is safe for v1. (Cal HMAC signature
// verification with a per-webhook secret is a future hardening — deferred.)
//
// Idempotency: Tours upsert by Cal's `uid` (externalId, externalSystem='cal').
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;

type CalWebhookEvent = {
  triggerEvent?: string;
  payload?: CalPayload;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(webhookLimiter, `wh-cal:${ip}`);
  if (!allowed) {
    return rateLimited("Rate limit exceeded", 60);
  }

  const { token } = await params;

  // Validate format before any DB work so probe-by-random-string attacks die
  // at the regex. Real tokens are minted as 32-char lowercase hex.
  if (!CAL_TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: CalWebhookEvent;
  try {
    body = JSON.parse(raw) as CalWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Resolve the org from the token. A bad/unknown token is a 404 — never
  // reveals whether the token format matched a real tenant.
  const org = await prisma.organization.findUnique({
    where: { calWebhookToken: token },
    select: { id: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await processCalBooking({
    orgId: org.id,
    trigger: body.triggerEvent ?? "",
    payload: body.payload ?? {},
  });

  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
