import "server-only";
import crypto from "node:crypto";
import {
  OAuthConfigError,
  type OAuthProvider,
  type OAuthStatePayload,
} from "./types";

// ---------------------------------------------------------------------------
// State-token signing for OAuth handshakes.
//
// The state param protects against CSRF and carries orgId + provider through
// the round-trip to the provider. We HMAC with a key derived from
// ENCRYPTION_KEY (already required at runtime for token storage). Falls back
// to OAUTH_STATE_SECRET if explicitly set so operators can rotate the OAuth
// state key independently from the at-rest crypto key.
// ---------------------------------------------------------------------------

const STATE_TTL_SECONDS = 10 * 60; // 10 min

function getStateSecret(): Buffer {
  const explicit = process.env.OAUTH_STATE_SECRET;
  if (explicit && explicit.length >= 32) {
    return Buffer.from(explicit, "utf8");
  }
  const encryption = process.env.ENCRYPTION_KEY;
  if (encryption && /^[0-9a-f]{64}$/i.test(encryption)) {
    // Derive a state-signing key from the encryption key so we don't reuse
    // raw key bytes for two different purposes (defense in depth).
    return crypto
      .createHmac("sha256", Buffer.from(encryption, "hex"))
      .update("oauth-state-signing-v1")
      .digest();
  }
  throw new OAuthConfigError(
    "Cannot sign OAuth state: set ENCRYPTION_KEY (32-byte hex) or OAUTH_STATE_SECRET (32+ chars).",
  );
}

export function signState(args: {
  orgId: string;
  provider: OAuthProvider;
  redirectUri: string;
  returnTo: string;
}): string {
  const payload: OAuthStatePayload = {
    orgId: args.orgId,
    provider: args.provider,
    redirectUri: args.redirectUri,
    returnTo: args.returnTo,
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sig = crypto
    .createHmac("sha256", getStateSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(token: string): OAuthStatePayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;

  let expected: string;
  try {
    expected = crypto
      .createHmac("sha256", getStateSecret())
      .update(body)
      .digest("base64url");
  } catch {
    return null;
  }

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as OAuthStatePayload;
    if (
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
