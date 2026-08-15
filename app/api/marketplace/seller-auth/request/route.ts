import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSellerSignInLink } from "@/lib/marketplace/seller-auth";
import { sendSellerSignInLinkEmail } from "@/lib/marketplace/emails";
import { publicSignupLimiter, checkRateLimit, getIp } from "@/lib/rate-limit";

const Schema = z.object({ email: z.string().email().max(200) });

export async function POST(req: NextRequest) {
  // Rate-limit per IP (fail-closed in prod) — same abuse surface as the buyer
  // magic-link route: unbounded MarketplaceSeller creation + email bombing.
  const { allowed } = await checkRateLimit(publicSignupLimiter, getIp(req));
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  try {
    const link = await createSellerSignInLink(parsed.data.email);
    const send = await sendSellerSignInLinkEmail({
      to: parsed.data.email,
      token: link.token,
    });
    if (!send.ok) {
      console.error("seller auth — send failed", send.error);
      return NextResponse.json({ error: "send_failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("seller auth — request failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
