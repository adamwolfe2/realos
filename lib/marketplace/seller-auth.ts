import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { MarketplaceSeller } from "@prisma/client";

// ---------------------------------------------------------------------------
// Marketplace SELLER auth — parallel to buyer auth, separate cookie.
//
// We use a different cookie name + a different shared secret namespace so a
// signed-in buyer cannot impersonate a seller and vice versa. Otherwise
// the mechanics (magic-link, HMAC-signed cookie, 30-day session) are
// identical to lib/marketplace/auth.ts.
// ---------------------------------------------------------------------------

const COOKIE_NAME = "ls_marketplace_seller_session";
const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function readSecret(): string {
  const secret =
    process.env.MARKETPLACE_AUTH_SECRET ?? process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      "MARKETPLACE_AUTH_SECRET (or ENCRYPTION_KEY) is not configured.",
    );
  }
  // Namespace into "seller" so the HMAC won't collide with the buyer secret.
  return `seller:${secret}`;
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmacHex(value: string): string {
  return crypto.createHmac("sha256", readSecret()).update(value).digest("hex");
}

export async function createSellerSignInLink(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Valid email required");
  }
  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const seller = await prisma.marketplaceSeller.upsert({
    where: { email: normalized },
    create: {
      email: normalized,
      signInTokenHash: tokenHash,
      signInExpiresAt: expiresAt,
      signInRequestedAt: new Date(),
    },
    update: {
      signInTokenHash: tokenHash,
      signInExpiresAt: expiresAt,
      signInRequestedAt: new Date(),
    },
    select: { id: true },
  });

  return { token, expiresAt, sellerId: seller.id };
}

export async function consumeSellerSignInToken(token: string): Promise<MarketplaceSeller | null> {
  if (!token || token.length < 32) return null;
  const tokenHash = sha256Hex(token);
  const seller = await prisma.marketplaceSeller.findFirst({
    where: {
      signInTokenHash: tokenHash,
      signInExpiresAt: { gt: new Date() },
    },
  });
  if (!seller) return null;
  await prisma.marketplaceSeller.update({
    where: { id: seller.id },
    data: {
      signInTokenHash: null,
      signInExpiresAt: null,
      lastSignInAt: new Date(),
    },
  });
  return seller;
}

export async function setSellerSession(sellerId: string): Promise<void> {
  const issuedAt = Date.now();
  const payload = `${sellerId}.${issuedAt}`;
  const signed = `${payload}.${hmacHex(payload)}`;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSellerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSellerSession(): Promise<MarketplaceSeller | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  const parts = cookie.value.split(".");
  if (parts.length !== 3) return null;
  const [sellerId, issuedAtStr, sig] = parts;
  const expected = hmacHex(`${sellerId}.${issuedAtStr}`);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))
  ) {
    return null;
  }
  const issuedAt = Number.parseInt(issuedAtStr, 10);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > SESSION_TTL_MS) return null;
  return prisma.marketplaceSeller.findUnique({ where: { id: sellerId } });
}
