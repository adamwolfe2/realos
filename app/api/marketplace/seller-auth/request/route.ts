import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSellerSignInLink } from "@/lib/marketplace/seller-auth";
import { sendSellerSignInLinkEmail } from "@/lib/marketplace/emails";

const Schema = z.object({ email: z.string().email().max(200) });

export async function POST(req: NextRequest) {
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
