import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSignInLink } from "@/lib/marketplace/auth";
import { sendSignInLinkEmail } from "@/lib/marketplace/emails";

// ---------------------------------------------------------------------------
// POST /api/marketplace/auth/request
//
// Body: { email: string }
//
// Generates a one-time sign-in link, stores the hash on a MarketplaceBuyer
// row (creating one if needed), and emails the buyer the link.
//
// Response is intentionally the same shape whether the email exists or not
// (to prevent account enumeration). The actual delivery happens via Resend.
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  email: z.string().email().max(200),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_email" },
      { status: 400 },
    );
  }

  try {
    const link = await createSignInLink(parsed.data.email);
    const send = await sendSignInLinkEmail({
      to: parsed.data.email,
      token: link.token,
    });
    if (!send.ok) {
      // Log but don't leak which email exists. Surface a generic error
      // so the buyer knows to try again.
      console.error("marketplace auth — send failed", send.error);
      return NextResponse.json(
        { error: "send_failed" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("marketplace auth — request failed", err);
    return NextResponse.json(
      { error: "internal" },
      { status: 500 },
    );
  }
}
