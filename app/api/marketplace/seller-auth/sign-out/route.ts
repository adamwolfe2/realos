import { NextRequest, NextResponse } from "next/server";
import { clearSellerSession } from "@/lib/marketplace/seller-auth";

export async function POST(req: NextRequest) {
  await clearSellerSession();
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/marketplace", req.url), 303);
  }
  return NextResponse.json({ ok: true });
}
