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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const draft = body as IntakeDraft;
  if (!draft || typeof draft !== "object") {
    return NextResponse.json({ error: "Invalid draft payload" }, { status: 400 });
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
