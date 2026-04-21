import { NextRequest, NextResponse } from "next/server";
import { verifyResumeToken } from "@/lib/onboarding/resume-token";

// ---------------------------------------------------------------------------
// GET /api/onboarding/resume?token=...
// Verifies an HMAC-signed resume token and returns the serialised IntakeDraft.
// The client picks this up and hydrates localStorage, then navigates to /onboarding.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const payload = verifyResumeToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid or expired resume link." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true, draft: payload.draft });
}
