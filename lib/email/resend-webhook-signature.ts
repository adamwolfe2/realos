import crypto from "node:crypto";

// Svix-style signature check for Resend webhooks (svix-id / svix-timestamp /
// svix-signature headers). Fails closed when RESEND_WEBHOOK_SECRET is unset.
export function verifySignature(body: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed always. A preview deployment connected to production DB
    // would otherwise let anyone forge bounce events that flip
    // Lead.unsubscribedFromEmails. Set RESEND_WEBHOOK_SECRET in every env.
    return false;
  }
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Replay-attack guard. The Svix scheme covers integrity (the body
  // hashes the timestamp into the signature) but not freshness — once
  // an attacker captures a valid (id, timestamp, signature, body) tuple
  // they can replay it indefinitely. Reject anything older than the
  // standard 5-minute Svix tolerance window.
  const tsSeconds = Number(svixTimestamp);
  if (!Number.isFinite(tsSeconds)) return false;
  const ageMs = Math.abs(Date.now() - tsSeconds * 1000);
  if (ageMs > 5 * 60 * 1000) return false;

  const toSign = `${svixId}.${svixTimestamp}.${body}`;
  // Svix secrets are "whsec_<base64 key>"; the HMAC key is the decoded
  // bytes, not the literal string (which rejected every real event).
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(toSign)
    .digest("base64");

  // svix-signature header format: "v1,<base64>"
  const parts = svixSignature.split(" ").map((p) => p.trim().split(","));
  for (const pair of parts) {
    if (pair.length < 2) continue;
    const provided = pair[1];
    try {
      if (
        crypto.timingSafeEqual(
          Buffer.from(provided),
          Buffer.from(expected)
        )
      ) {
        return true;
      }
    } catch {
      // ignore length mismatch
    }
  }
  return false;
}
