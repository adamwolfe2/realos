import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { MarketplaceBuyer } from "@prisma/client";

// ---------------------------------------------------------------------------
// Marketplace buyer auth — standalone magic-link, NOT Clerk
//
// Auth model:
//   1. Buyer enters email at /marketplace/buyer/sign-in
//   2. POST /api/marketplace/auth/request generates a 32-byte token,
//      stores its SHA-256 hash on the buyer row (creating one if needed),
//      emails the buyer a link containing the raw token.
//   3. Buyer clicks the link. GET /api/marketplace/auth/verify validates
//      the token (hashes it, looks up the buyer, checks expiry), then
//      sets a signed session cookie and redirects to /marketplace/buyer.
//   4. Subsequent requests read the cookie via getBuyerSession().
//
// Session cookie format:
//   "<buyerId>.<issuedAt>.<hmac>" — HMAC-SHA256 with MARKETPLACE_AUTH_SECRET.
//   30-day expiry. httpOnly, secure, sameSite=Lax. No DB session table —
//   the cookie is self-contained and revocable by rotating the secret.
// ---------------------------------------------------------------------------

const COOKIE_NAME = "ls_marketplace_session";
const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function readSecret(): string {
  const secret =
    process.env.MARKETPLACE_AUTH_SECRET ?? process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      "MARKETPLACE_AUTH_SECRET (or ENCRYPTION_KEY) is not configured — at least 32 chars required.",
    );
  }
  return secret;
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmacHex(value: string): string {
  return crypto.createHmac("sha256", readSecret()).update(value).digest("hex");
}

function signSessionPayload(payload: string): string {
  return `${payload}.${hmacHex(payload)}`;
}

function verifySessionPayload(signed: string): { buyerId: string; issuedAt: number } | null {
  const parts = signed.split(".");
  if (parts.length !== 3) return null;
  const [buyerId, issuedAtStr, sig] = parts;
  const expected = hmacHex(`${buyerId}.${issuedAtStr}`);
  // Constant-time compare to prevent timing attacks.
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))
  ) {
    return null;
  }
  const issuedAt = Number.parseInt(issuedAtStr, 10);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > SESSION_TTL_MS) return null;
  return { buyerId, issuedAt };
}

// ---------------------------------------------------------------------------
// Public helpers — used by API routes + server components.

export type SignInLinkResult = {
  token: string;       // raw token, included in the magic-link URL
  expiresAt: Date;
  buyerId: string;
};

export async function createSignInLink(email: string): Promise<SignInLinkResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Valid email required");
  }
  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const buyer = await prisma.marketplaceBuyer.upsert({
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

  return { token, expiresAt, buyerId: buyer.id };
}

export async function consumeSignInToken(token: string): Promise<MarketplaceBuyer | null> {
  if (!token || token.length < 32) return null;
  const tokenHash = sha256Hex(token);
  const buyer = await prisma.marketplaceBuyer.findFirst({
    where: {
      signInTokenHash: tokenHash,
      signInExpiresAt: { gt: new Date() },
    },
  });
  if (!buyer) return null;
  // One-time use — clear token immediately on success.
  await prisma.marketplaceBuyer.update({
    where: { id: buyer.id },
    data: {
      signInTokenHash: null,
      signInExpiresAt: null,
      lastSignInAt: new Date(),
    },
  });
  return buyer;
}

export async function setBuyerSession(buyerId: string): Promise<void> {
  const issuedAt = Date.now();
  const payload = `${buyerId}.${issuedAt}`;
  const signed = signSessionPayload(payload);
  const cookieStore = await cookies();
  // Always set Secure — Vercel serves prod + preview over HTTPS, and local
  // dev should use https://localhost. Avoid branching on NODE_ENV so
  // staging never accidentally issues a non-secure session cookie.
  cookieStore.set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearBuyerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getBuyerSession(): Promise<MarketplaceBuyer | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  const parsed = verifySessionPayload(cookie.value);
  if (!parsed) return null;
  return prisma.marketplaceBuyer.findUnique({
    where: { id: parsed.buyerId },
  });
}

// Strict variant — throws (or returns null) for use in pages that must
// have a logged-in buyer. Caller redirects to sign-in on null.
export async function requireBuyer(): Promise<MarketplaceBuyer | null> {
  return getBuyerSession();
}
