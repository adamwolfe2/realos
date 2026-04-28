import { NextRequest, NextResponse } from "next/server";
import {
  publicSignupLimiter,
  checkRateLimit,
  getIp,
} from "@/lib/rate-limit";
import { signResumeToken } from "@/lib/onboarding/resume-token";
import type { IntakeDraft } from "@/components/intake/constants";

// ---------------------------------------------------------------------------
// POST /api/onboarding/save-draft
// Accepts the current IntakeDraft, returns a signed resume token.
// The client builds a copyable URL: /onboarding?resume=<token>
// Rate-limited via publicSignupLimiter.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(publicSignupLimiter, ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests, try again later." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  // Cap raw body at 64 KB so we don't sign arbitrarily large blobs. Resume
  // payloads are a handful of strings and a small modules object — anything
  // bigger is abuse.
  const MAX_DRAFT_BYTES = 64 * 1024;
  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_DRAFT_BYTES) {
    return NextResponse.json({ error: "Draft too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid draft payload" }, { status: 400 });
  }

  // Reject any object that re-stringifies above the cap (catches deeply
  // nested or repeated-key payloads that survive the raw-body check).
  const draft = body as IntakeDraft;
  if (Buffer.byteLength(JSON.stringify(draft), "utf8") > MAX_DRAFT_BYTES) {
    return NextResponse.json({ error: "Draft too large" }, { status: 413 });
  }

  try {
    const token = signResumeToken(draft);
    return NextResponse.json({ ok: true, token });
  } catch (err) {
    // Likely OAUTH_STATE_SECRET is not configured in dev.
    console.error("[save-draft] token signing failed:", err);
    return NextResponse.json(
      { error: "Resume links are not available right now." },
      { status: 503 }
    );
  }
}
