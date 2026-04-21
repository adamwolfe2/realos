// Resume token helpers for the intake wizard.
// Uses the same HMAC-signed base64url pattern as lib/integrations/oauth-config.ts.
// Tokens are valid for 72 hours.

import crypto from "node:crypto";
import type { IntakeDraft } from "@/components/intake/constants";

const TTL_SECONDS = 72 * 60 * 60; // 72 hours

export type ResumePayload = {
  /** intake form draft, serialised */
  draft: IntakeDraft;
  exp: number; // unix seconds
};

function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("OAUTH_STATE_SECRET is missing or too short (need 32+ chars).");
  }
  return secret;
}

export function signResumeToken(draft: IntakeDraft): string {
  const payload: ResumePayload = {
    draft,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyResumeToken(token: string): ResumePayload | null {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const body = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  if (!body || !sig) return null;

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");

  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expected, "base64url"))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as ResumePayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
