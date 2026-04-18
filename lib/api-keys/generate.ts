import "server-only";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// API key generation helpers.
//
// Format:  re_live_<64 hex chars>        (total length = 72)
// Prefix:  first 12 chars (re_live_aB12) — stored for display only.
// Hash:    SHA-256 of the full raw key, hex — stored for lookup.
//
// The raw key is returned exactly ONCE by generateApiKey() and must be
// rendered to the operator immediately. We never re-derive or re-fetch it.
// ---------------------------------------------------------------------------

const KEY_PREFIX = "re_live_";
const PREFIX_DISPLAY_LENGTH = 12;

export type GeneratedApiKey = {
  raw: string;
  prefix: string;
  hash: string;
};

export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generateApiKey(): GeneratedApiKey {
  const body = crypto.randomBytes(32).toString("hex");
  const raw = `${KEY_PREFIX}${body}`;
  return {
    raw,
    prefix: raw.slice(0, PREFIX_DISPLAY_LENGTH),
    hash: hashApiKey(raw),
  };
}
