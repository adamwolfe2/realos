import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { getSiteUrl } from "@/lib/brand";

// ---------------------------------------------------------------------------
// Email suppression — generic opt-out list keyed by email address.
//
// Two flows feed this:
//
//   1. RFC 8058 one-click unsubscribe. Gmail/Yahoo/Apple Mail send a
//      POST to the URL in `List-Unsubscribe`; we record the suppression
//      and respond 200 OK. POST handler at /api/unsub/one-click.
//
//   2. Browser unsubscribe. The visible "Unsubscribe" link in the
//      email footer is a GET to /unsub/email?e=<email>&t=<token>. The
//      page records the suppression and shows a confirmation.
//
// Both paths use the same HMAC-signed token so neither can be triggered
// without proof the requester actually got the email (avoids drive-by
// suppression of arbitrary addresses).
//
// EVERY email send (sendBrandedEmail + the legacy safeSends) MUST call
// `isEmailSuppressed()` before dispatching to Resend. The check is in
// the canonical helper; per-file safeSends inherit it via the helper
// or through a direct call.
// ---------------------------------------------------------------------------

function unsubSecret(): string {
  const secret = process.env.UNSUB_SECRET ?? process.env.RESEND_API_KEY ?? "";
  if (!secret) {
    // Fall back to a stable derived secret so we never crash sends —
    // the cost is that tokens become forgeable in a misconfigured
    // environment, which is acceptable for an opt-out (worst case:
    // someone unsubs themselves a second time).
    return "leasestack-unsub-fallback-key";
  }
  return secret;
}

export function emailUnsubToken(email: string): string {
  return crypto
    .createHmac("sha256", unsubSecret())
    .update(email.toLowerCase())
    .digest("hex")
    .slice(0, 24);
}

export function verifyEmailUnsubToken(
  email: string,
  token: string,
): boolean {
  if (!token || typeof token !== "string") return false;
  try {
    const expected = emailUnsubToken(email);
    if (expected.length !== token.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(token),
    );
  } catch {
    return false;
  }
}

/**
 * Build the URL that goes in the `List-Unsubscribe` header AND the
 * visible footer link. The same URL accepts both POST (one-click) and
 * GET (browser).
 */
export function buildEmailUnsubUrl(email: string): string {
  const base = getSiteUrl();
  const e = encodeURIComponent(email.toLowerCase());
  const t = emailUnsubToken(email);
  return `${base}/api/unsub/one-click?e=${e}&t=${t}`;
}

export function buildEmailUnsubBrowserUrl(email: string): string {
  // Browser-friendly URL with a confirmation page rather than the
  // raw POST endpoint. Kept separate so we can change the page UX
  // without breaking the one-click flow.
  const base = getSiteUrl();
  const e = encodeURIComponent(email.toLowerCase());
  const t = emailUnsubToken(email);
  return `${base}/unsub/email?e=${e}&t=${t}`;
}

export async function isEmailSuppressed(
  email: string | string[],
): Promise<boolean> {
  const emails = Array.isArray(email) ? email : [email];
  const lowered = emails
    .filter((e): e is string => typeof e === "string" && e.length > 0)
    .map((e) => e.trim().toLowerCase());
  if (lowered.length === 0) return false;
  try {
    const found = await prisma.emailSuppression.findFirst({
      where: { email: { in: lowered } },
      select: { id: true },
    });
    return found != null;
  } catch (err) {
    // Don't block sending on a transient DB error — log and let it
    // through. Bouncing mail because the suppression check fell over
    // is worse than re-emailing someone who unsubscribed.
    console.warn("[suppression] check failed:", err);
    return false;
  }
}

export async function suppressEmail(input: {
  email: string;
  reason?: string | null;
  category?: string | null;
  source?: string | null;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) return;
  await prisma.emailSuppression
    .upsert({
      where: { email },
      update: {
        reason: input.reason ?? undefined,
        category: input.category ?? undefined,
        source: input.source ?? undefined,
        unsubscribedAt: new Date(),
      },
      create: {
        email,
        reason: input.reason ?? "manual",
        category: input.category ?? null,
        source: input.source ?? null,
      },
    })
    .catch((err) => {
      console.error("[suppression] failed to upsert:", err);
    });
}
