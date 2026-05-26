import { NextRequest, NextResponse } from "next/server";
import { clearBuyerSession } from "@/lib/marketplace/auth";

// POST /api/marketplace/auth/sign-out — clears the session cookie.
// Redirects to /marketplace on form-driven submits, returns JSON otherwise.
export async function POST(req: NextRequest) {
  await clearBuyerSession();
  // Form posts come with Accept: text/html — those want a redirect.
  // fetch() calls come with Accept: */* or application/json — those get JSON.
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/marketplace", req.url), 303);
  }
  return NextResponse.json({ ok: true });
}
