import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

// ---------------------------------------------------------------------------
// SSRF guard for OUTBOUND requests to operator-supplied URLs.
//
// Some integrations (Funnel Leasing) let the operator type in the API base
// URL because the real host varies per account and isn't publicly documented.
// Other callers (property-image scraper, popup/pixel install probes, org
// enrichment) fetch a tenant's own marketing site. A free-form URL is an SSRF
// vector: an operator (or an attacker who reached an operator-level action)
// can point it at localhost, an internal service, or the cloud metadata
// endpoint (169.254.169.254), and the server will happily fetch it — leaking
// credentials/PII or probing the internal network from our infra.
//
// This guard rejects any URL whose host is (or DNS-resolves to) a private,
// loopback, link-local, CGNAT, or otherwise non-public address. Validate at
// config time for fast feedback AND immediately before each fetch — resolving
// at fetch time is what defeats a host that later rebinds to a private IP.
//
// Three entry points, same underlying IP/hostname rules:
//   - `isAllowedUrl`         sync, no DNS. Fast validation of a literal IP or
//                            an obviously-blocked hostname at form-submission
//                            time. A hostname that isn't a literal IP and
//                            isn't on the blocklist passes (it hasn't been
//                            resolved yet) — NOT sufficient on its own before
//                            a fetch.
//   - `isAllowedUrlWithDns`  async boolean. Runs `isAllowedUrl` first, then
//                            resolves the hostname and re-checks every
//                            returned address. Use immediately before any
//                            outbound fetch, including each redirect hop.
//   - `assertPublicHttpUrl`  async, throws `SsrfError` instead of returning
//                            false. Same rules as `isAllowedUrlWithDns`, for
//                            callers that prefer throw-on-reject.
//
// Residual: a sub-second DNS-rebind between this lookup and fetch's own connect
// is not closed here (that needs IP pinning); the fetch-time re-check shrinks
// the window to near-zero for the low-frequency cron/lead-push callers.
// ---------------------------------------------------------------------------

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

// Hostnames that are always unsafe regardless of what they resolve to (or
// even if they don't resolve at all in this environment). Checked before any
// DNS lookup as a fail-fast, defense-in-depth layer on top of the IP-range
// checks below — a resolver quirk (e.g. "localhost" not hitting /etc/hosts,
// or a cloud metadata hostname failing to resolve outside its own cloud) must
// never be the only thing standing between an operator-supplied URL and an
// internal target.
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
  "metadata.aws.internal",
  "instance-data",
  "instance-data.ec2.internal",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const octet = Number(p);
    if (octet > 255) return null;
    n = n * 256 + octet;
  }
  return n >>> 0;
}

function inCidr(ipInt: number, baseIp: string, bits: number): boolean {
  const base = ipv4ToInt(baseIp);
  if (base === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (base & mask);
}

// Private / reserved / special-use IPv4 ranges that must never be reachable
// from an operator-supplied URL.
const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local + cloud metadata (169.254.169.254)
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
  ["255.255.255.255", 32],
];

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable → treat as unsafe
  return BLOCKED_V4.some(([base, bits]) => inCidr(n, base, bits));
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  // IPv4-mapped addresses (::ffff:*) always embed a v4 address; the URL parser
  // may hand us either the dotted (::ffff:127.0.0.1) or the compressed hex
  // (::ffff:7f00:1) form. Extract the embedded v4 and check it in both cases.
  const mappedDotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDotted) return isBlockedIpv4(mappedDotted[1]);
  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isBlockedIpv4(v4);
  }
  // Unique-local fc00::/7 (fc/fd), link-local fe80::/10, deprecated site-local
  // fec0::/10, multicast ff00::/8, documentation 2001:db8::/32.
  if (/^f[cd]/.test(lower)) return true;
  if (/^fe[89ab]/.test(lower)) return true;
  if (/^fe[cdef]/.test(lower)) return true;
  if (/^ff/.test(lower)) return true;
  if (lower.startsWith("2001:db8")) return true;
  return false;
}

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedIpv4(ip);
  if (net.isIPv6(ip)) return isBlockedIpv6(ip);
  return true; // not a recognizable IP → unsafe
}

// url.hostname keeps IPv6 literals bracket-wrapped ("[::1]") and Node's URL
// parser lowercases hostnames already, but strip brackets defensively so
// net.isIP / the BLOCKED_HOSTNAMES lookup always see the bare form.
function bareHostOf(host: string): string {
  const stripped =
    host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  return stripped.toLowerCase();
}

/**
 * Structural (no-DNS) validation: parseable http(s) URL, no embedded
 * credentials, not an explicitly blocked hostname, and — if the host is a
 * literal IP — not a private/reserved address. A non-IP hostname that isn't
 * on the blocklist returns true here without proof it's safe; DNS hasn't run
 * yet. Fast path for form-submission-time feedback only — NOT sufficient on
 * its own immediately before a fetch (use `isAllowedUrlWithDns` there).
 */
export function isAllowedUrl(urlString: string): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  // Reject userinfo (https://user:pass@host) — defends against credential
  // leakage and parser-ambiguity tricks in any downstream re-parse of the
  // raw string, even though `url.hostname` itself is already unambiguous.
  if (url.username || url.password) return false;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (!url.hostname) return false;

  const bareHost = bareHostOf(url.hostname);
  if (BLOCKED_HOSTNAMES.has(bareHost)) return false;

  if (net.isIP(bareHost)) return !isBlockedIp(bareHost);

  // Non-IP hostname (including any numeric-looking encoding — Node/WHATWG's
  // URL parser already canonicalizes decimal/octal/hex IPv4 encodings like
  // "2130706433" or "0x7f000001" into dotted-decimal at `new URL()` time, so
  // they hit the net.isIP branch above, not this one).
  return true;
}

/**
 * DNS-resolved validation. Runs `isAllowedUrl` first, then — for a hostname
 * (not a literal IP) — resolves ALL addresses and rejects if any is private.
 * Resolving every record prevents a host that mixes a public and a private
 * A/AAAA record, and re-resolving at call time (rather than trusting a
 * cached/earlier check) is what catches a host that DNS-rebinds to a private
 * IP between validation and fetch. Use immediately before every outbound
 * fetch to a user-controlled URL, including each redirect hop.
 */
export async function isAllowedUrlWithDns(urlString: string): Promise<boolean> {
  if (!isAllowedUrl(urlString)) return false;

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  const bareHost = bareHostOf(url.hostname);
  // Literal IP host — isAllowedUrl already validated it, no DNS needed.
  if (net.isIP(bareHost)) return true;

  let addrs: Array<{ address: string }>;
  try {
    addrs = await lookup(bareHost, { all: true });
  } catch {
    // Fail closed: if DNS doesn't resolve we can't prove it's safe.
    return false;
  }
  if (addrs.length === 0) return false;
  for (const { address } of addrs) {
    if (isBlockedIp(address)) return false;
  }
  return true;
}

/**
 * Validate an operator-supplied URL is a public http(s) endpoint. Throws
 * SsrfError if the protocol is unsupported, the host is missing or blocked,
 * the URL embeds credentials, the host is a literal private IP, or DNS
 * resolves it to any private/reserved address. Returns the parsed URL on
 * success. Same underlying rules as `isAllowedUrlWithDns`; use this variant
 * when the caller prefers throw-on-reject over a boolean.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("URL must use http or https");
  }
  if (url.username || url.password) {
    throw new SsrfError("URL must not contain credentials");
  }
  const host = url.hostname;
  if (!host) throw new SsrfError("URL has no host");

  const bareHost = bareHostOf(host);
  if (BLOCKED_HOSTNAMES.has(bareHost)) {
    throw new SsrfError("URL host is a disallowed hostname");
  }

  // Literal IP host — check directly, no DNS.
  if (net.isIP(bareHost)) {
    if (isBlockedIp(bareHost)) {
      throw new SsrfError("URL host is a private or reserved address");
    }
    return url;
  }

  // Hostname — resolve ALL addresses and reject if any is private. Resolving
  // every record prevents a host that mixes a public and a private A record.
  let addrs: Array<{ address: string }>;
  try {
    addrs = await lookup(bareHost, { all: true });
  } catch {
    throw new SsrfError("URL host could not be resolved");
  }
  if (addrs.length === 0) throw new SsrfError("URL host did not resolve");
  for (const { address } of addrs) {
    if (isBlockedIp(address)) {
      throw new SsrfError("URL host resolves to a private or reserved address");
    }
  }
  return url;
}
