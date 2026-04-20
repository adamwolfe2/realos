import "server-only";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Public site key generator. Used by the first-party visitor pixel.
//
// Format: pk_site_<base62 32 chars>            (total length = 40)
// Prefix: first 12 chars (pk_site_aB12)        — safe to display in UI.
//
// These keys are PUBLIC — they ship inside the JS snippet that runs on the
// tenant's marketing site. They authorise only anonymous-pageview ingestion
// (pixel events) and are rate-limited per IP + per key. They cannot be used
// for any server-side write surface.
// ---------------------------------------------------------------------------

const KEY_PREFIX = "pk_site_";
const PREFIX_DISPLAY_LENGTH = 12;
const BODY_LENGTH = 32;

const BASE62 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export type GeneratedPublicSiteKey = {
  raw: string;
  prefix: string;
};

function randomBase62(length: number): string {
  // Reject-sample to avoid modulo bias.
  const bytes = crypto.randomBytes(length * 2);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < length; i += 1) {
    const byte = bytes[i];
    if (byte < 248) {
      // 248 = 4 * 62, the largest multiple of 62 below 256
      out += BASE62[byte % 62];
    }
  }
  if (out.length < length) {
    return out + randomBase62(length - out.length);
  }
  return out;
}

export function generatePublicSiteKey(): GeneratedPublicSiteKey {
  const body = randomBase62(BODY_LENGTH);
  const raw = `${KEY_PREFIX}${body}`;
  return {
    raw,
    prefix: raw.slice(0, PREFIX_DISPLAY_LENGTH),
  };
}

export function isPublicSiteKeyShape(value: string): boolean {
  if (typeof value !== "string") return false;
  if (!value.startsWith(KEY_PREFIX)) return false;
  if (value.length !== KEY_PREFIX.length + BODY_LENGTH) return false;
  for (let i = KEY_PREFIX.length; i < value.length; i += 1) {
    if (BASE62.indexOf(value[i]) < 0) return false;
  }
  return true;
}
