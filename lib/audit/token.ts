import { randomBytes } from "node:crypto";

// 32-char URL-safe token from 24 random bytes (base64url).
// 24 bytes → 32 base64url chars (no padding). 192 bits of entropy,
// well above the threshold for unguessable public share links.
export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

// Length + charset check. Mirrors the alphabet emitted by base64url
// (A-Z, a-z, 0-9, '-', '_'). 32-char fixed length. No DB lookup.
const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
export function isValidShareToken(t: string): boolean {
  return typeof t === "string" && SHARE_TOKEN_RE.test(t);
}

// Normalise a user-supplied URL or hostname down to a bare domain.
// Accepts: "https://www.greystar.com/", "greystar.com", "GREYSTAR.com/about"
// Returns: "greystar.com" — or null when the input can't be a real
// public domain (no dot, IP address, localhost, single label).
export function normalizeDomain(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  // Add a scheme so URL can parse "greystar.com/about"-style bare inputs.
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let host: string;
  try {
    const u = new URL(withScheme);
    host = u.hostname;
  } catch {
    return null;
  }

  host = host.toLowerCase().trim();
  if (host.startsWith("www.")) host = host.slice(4);
  if (host.endsWith(".")) host = host.slice(0, -1);

  if (!host) return null;
  if (host === "localhost") return null;
  // Reject IPv4 / IPv6.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  if (host.includes(":")) return null;
  // Must have at least one dot and a TLD-like suffix (2+ chars).
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
  if (host.includes("..")) return null;

  return host;
}
