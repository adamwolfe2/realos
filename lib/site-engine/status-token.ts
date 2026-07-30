import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Signed status-page tokens for public site requests.
//
// A public submitter (no LeaseStack account) gets a URL like:
//   /sites/status/{slug}?token={signed}
// The token is an HMAC-SHA256 of `{slug}.{expiresAt}` using the dedicated
// SITE_ENGINE_SECRET env var. There is deliberately NO fallback to another
// service's secret (e.g. Clerk's) — a leaked/rotated status token must never
// be able to compromise (or be compromised by) an unrelated auth secret.
// Embedded alongside is the expiry timestamp so we don't need DB lookups to
// validate.
//
// Format: `${expiresAtMs}.${base64UrlSig}`
// ---------------------------------------------------------------------------

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const s = process.env.SITE_ENGINE_SECRET?.trim();
  if (!s) {
    throw new Error(
      "SITE_ENGINE_SECRET is not set; cannot sign or verify status tokens",
    );
  }
  return s;
}

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: string): string {
  return base64Url(createHmac("sha256", getSecret()).update(payload).digest());
}

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

export function issueStatusToken(slug: string, ttlMs = ONE_WEEK_MS): IssuedToken {
  const expiresAtMs = Date.now() + ttlMs;
  const payload = `${slug}.${expiresAtMs}`;
  const sig = sign(payload);
  return {
    token: `${expiresAtMs}.${sig}`,
    expiresAt: new Date(expiresAtMs),
  };
}

export function verifyStatusToken(slug: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const [expiresStr, sig] = token.split(".");
  if (!expiresStr || !sig) return false;
  const expiresAtMs = Number(expiresStr);
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) return false;

  const expected = sign(`${slug}.${expiresAtMs}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildStatusUrl(appUrl: string, slug: string, token: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/sites/status/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;
}
