import "server-only";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Share token for ClientReport. 24 chars of URL-safe base64 (~144 bits of
// entropy) so /r/[token] links are unguessable but short enough for email
// copy-paste. Regenerate once per report at creation time.
// ---------------------------------------------------------------------------

const TOKEN_LENGTH = 24;

export function generateShareToken(): string {
  // 18 random bytes encoded as base64url yields exactly 24 chars.
  const bytes = crypto.randomBytes(18);
  const b64 = bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return b64.slice(0, TOKEN_LENGTH);
}

export function isValidShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{24}$/.test(token);
}
