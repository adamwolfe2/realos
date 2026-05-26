import { NextRequest, NextResponse } from "next/server";
import { consumeSignInToken, setBuyerSession } from "@/lib/marketplace/auth";

// ---------------------------------------------------------------------------
// GET /api/marketplace/auth/verify?token=...&next=/marketplace/...
//
// Magic-link landing endpoint. Validates the token, sets the session
// cookie, and 302s to the buyer dashboard (or the `next` param if safe).
// ---------------------------------------------------------------------------

const SAFE_NEXT_PREFIX = "/marketplace";
const DEFAULT_REDIRECT = "/marketplace/buyer";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const next = req.nextUrl.searchParams.get("next");

  if (!token) {
    return NextResponse.redirect(
      new URL("/marketplace/buyer/sign-in?error=missing_token", req.url),
    );
  }

  const buyer = await consumeSignInToken(token);
  if (!buyer) {
    return NextResponse.redirect(
      new URL("/marketplace/buyer/sign-in?error=invalid_or_expired", req.url),
    );
  }

  await setBuyerSession(buyer.id);

  // Constrain `next` to internal marketplace URLs only.
  const dest =
    next && next.startsWith(SAFE_NEXT_PREFIX) ? next : DEFAULT_REDIRECT;
  return NextResponse.redirect(new URL(dest, req.url));
}
