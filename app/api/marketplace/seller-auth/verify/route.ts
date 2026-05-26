import { NextRequest, NextResponse } from "next/server";
import { consumeSellerSignInToken, setSellerSession } from "@/lib/marketplace/seller-auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(
      new URL("/marketplace/seller/sign-in?error=missing_token", req.url),
    );
  }
  const seller = await consumeSellerSignInToken(token);
  if (!seller) {
    return NextResponse.redirect(
      new URL("/marketplace/seller/sign-in?error=invalid_or_expired", req.url),
    );
  }
  await setSellerSession(seller.id);
  return NextResponse.redirect(new URL("/marketplace/seller", req.url));
}
