import "server-only";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// URL normalization + sha256 hashing for deduping mentions across sources.
//
// Why normalize before hashing: Tavily, Reddit direct, and Google may surface
// the *same* Reddit thread via slightly different URLs (http vs https, with
// or without `/?share=...`, with tracking params, or under `old.reddit.com`
// vs `www.reddit.com`). Normalizing strips these differences so the unique
// index on `(orgId, propertyId, urlHash)` catches the duplicate.
// ---------------------------------------------------------------------------

const TRACKING_PARAM_PREFIXES = [
  "utm_",
  "fbclid",
  "gclid",
  "mc_eid",
  "mc_cid",
  "_ga",
  "ref",
  "ref_src",
  "ref_url",
  "share",
];

function isTrackingParam(key: string): boolean {
  const k = key.toLowerCase();
  return TRACKING_PARAM_PREFIXES.some((p) =>
    k === p || k.startsWith(p + "_") || (p.endsWith("_") && k.startsWith(p))
  );
}

function normalizeHost(host: string): string {
  const lower = host.toLowerCase();
  // Collapse reddit host variants; the underlying thread is the same.
  if (/(^|\.)reddit\.com$/.test(lower)) return "www.reddit.com";
  // Collapse Yelp locale subdomains (e.g. "m.yelp.com", "www.yelp.com").
  if (/(^|\.)yelp\.com$/.test(lower)) return "www.yelp.com";
  // Collapse Google Maps hosts.
  if (
    lower === "maps.google.com" ||
    lower === "www.google.com" ||
    lower === "google.com"
  ) {
    return "www.google.com";
  }
  return lower.replace(/^m\./, "www.");
}

function normalizePath(pathname: string): string {
  // Collapse trailing slash except for root.
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

export function normalizeUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    // Fall back to raw-string normalization for invalid URLs so we still
    // dedupe on text-level equality.
    return raw.trim().toLowerCase();
  }

  // Drop fragments — they never identify a distinct resource.
  u.hash = "";

  // Normalize protocol to https where safe.
  if (u.protocol === "http:") u.protocol = "https:";

  // Normalize host + path.
  u.host = normalizeHost(u.host);
  u.pathname = normalizePath(u.pathname);

  // Strip tracking params.
  const params = new URLSearchParams(u.search);
  const cleaned = new URLSearchParams();
  // Sort keys for stable ordering.
  const keys = Array.from(params.keys())
    .filter((k) => !isTrackingParam(k))
    .sort();
  for (const k of keys) {
    const values = params.getAll(k).sort();
    for (const v of values) cleaned.append(k, v);
  }
  u.search = cleaned.toString() ? `?${cleaned.toString()}` : "";

  return u.toString();
}

export function hashUrl(raw: string): string {
  const normalized = normalizeUrl(raw);
  return createHash("sha256").update(normalized).digest("hex");
}
