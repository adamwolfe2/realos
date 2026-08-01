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
// Four entry points, same underlying IP/hostname rules:
//   - `isAllowedUrl`         sync, no DNS. Fast validation of a literal IP or
//                            an obviously-blocked hostname at form-submission
//                            time. A hostname that isn't a literal IP and
//                            isn't on the blocklist passes (it hasn't been
//                            resolved yet) — NOT sufficient on its own before
//                            a fetch.
//   - `isAllowedUrlWithDns`  async boolean. Resolves the hostname and
//                            re-checks every returned address. Use
//                            immediately before any outbound fetch,
//                            including each redirect hop.
//   - `assertPublicHttpUrl`  async, throws `SsrfError` instead of returning
//                            false. Same rules as `isAllowedUrlWithDns`, for
//                            callers that prefer throw-on-reject.
//   - `safeFetchFollowingRedirects` async fetch wrapper. Follows redirects
//                            manually, re-running `isAllowedUrlWithDns` on
//                            every hop's Location before following it —
//                            `fetch(url, { redirect: "follow" })` would let a
//                            tenant-controlled host 302 straight past the
//                            pre-flight check on the original URL. Use this
//                            instead of `redirect: "follow"` for any fetch of
//                            an operator-supplied URL.
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

// Expand any valid textual IPv6 form (compressed "::", full 8-group, mixed
// IPv4-tail like "::ffff:127.0.0.1", zone id "%eth0") into eight 16-bit
// numeric groups. Returns null if the input isn't a well-formed IPv6
// address. Matching on the expanded numeric form (rather than string/regex
// prefix matching on whatever textual form happened to arrive) is what
// catches uncompressed inputs like "0:0:0:0:0:0:0:1" — a canonical-looking
// regex like /^::1$/ never sees those.
function expandIpv6(ip: string): number[] | null {
  let addr = ip;
  const pct = addr.indexOf("%");
  if (pct !== -1) addr = addr.slice(0, pct);

  // A trailing dotted-quad (IPv4-mapped/-compatible textual form) becomes
  // two hex groups so the rest of the expansion only ever deals with
  // colon-separated hex groups.
  const lastColon = addr.lastIndexOf(":");
  if (lastColon !== -1 && addr.includes(".", lastColon)) {
    const v4 = ipv4ToInt(addr.slice(lastColon + 1));
    if (v4 === null) return null;
    const hexA = ((v4 >>> 16) & 0xffff).toString(16);
    const hexB = (v4 & 0xffff).toString(16);
    addr = `${addr.slice(0, lastColon + 1)}${hexA}:${hexB}`;
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null; // more than one "::" is never valid
  const head = halves[0] === "" ? [] : halves[0].split(":");
  const tail =
    halves.length === 2 ? (halves[1] === "" ? [] : halves[1].split(":")) : [];
  if (halves.length === 1) {
    if (head.length !== 8) return null; // no "::" → must spell all 8 groups
  } else if (head.length + tail.length > 8) {
    return null;
  }
  const missing = 8 - head.length - tail.length;
  const groups = [
    ...head,
    ...Array(halves.length === 2 ? missing : 0).fill("0"),
    ...tail,
  ];
  if (groups.length !== 8) return null;

  const nums: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    nums.push(parseInt(g, 16));
  }
  return nums;
}

function groupsToIpv4(hi: number, lo: number): string {
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isBlockedIpv6(ip: string): boolean {
  const g = expandIpv6(ip);
  if (!g) return true; // unparseable → treat as unsafe

  // Unspecified :: — all groups zero.
  if (g.every((n) => n === 0)) return true;
  // Loopback ::1 — first 7 groups zero, last group 1.
  if (g.slice(0, 7).every((n) => n === 0) && g[7] === 1) return true;
  // IPv4-mapped ::ffff:a.b.c.d — first 4 groups zero, 5th group 0xffff.
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
    return isBlockedIpv4(groupsToIpv4(g[6], g[7]));
  }
  // IPv4-compatible (deprecated) ::a.b.c.d — first 6 groups zero. (:: and
  // ::1 are already handled above, so this only matches a nonzero embedded
  // v4.)
  if (g.slice(0, 6).every((n) => n === 0)) {
    return isBlockedIpv4(groupsToIpv4(g[6], g[7]));
  }
  // NAT64 well-known prefix 64:ff9b::/96 — synthesizes an IPv6 address from
  // an IPv4 one; treat the embedded v4 the same as any other IPv4-embedded
  // form (blocks e.g. 64:ff9b::7f00:1 → embeds 127.0.0.1).
  if (g[0] === 0x0064 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
    return isBlockedIpv4(groupsToIpv4(g[6], g[7]));
  }
  // Unique-local fc00::/7 — top 7 bits of the first group are 1111110.
  if ((g[0] & 0xfe00) === 0xfc00) return true;
  // Link-local fe80::/10 — top 10 bits of the first group are 1111111010.
  if ((g[0] & 0xffc0) === 0xfe80) return true;
  // Deprecated site-local fec0::/10 — top 10 bits are 1111111011.
  if ((g[0] & 0xffc0) === 0xfec0) return true;
  // Multicast ff00::/8.
  if ((g[0] & 0xff00) === 0xff00) return true;
  // Documentation range 2001:db8::/32.
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true;
  return false;
}

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedIpv4(ip);
  if (net.isIPv6(ip)) return isBlockedIpv6(ip);
  return true; // not a recognizable IP → unsafe
}

// url.hostname keeps IPv6 literals bracket-wrapped ("[::1]") and Node's URL
// parser lowercases hostnames already, but strip brackets defensively so
// net.isIP / the BLOCKED_HOSTNAMES lookup always see the bare form. Also
// strip a single trailing dot — "localhost." is a valid, resolver-equivalent
// FQDN form of "localhost" (root-zone terminator) that would otherwise slip
// past BLOCKED_HOSTNAMES because the Set only has the undotted spelling.
function bareHostOf(host: string): string {
  const stripped =
    host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const lower = stripped.toLowerCase();
  return lower.endsWith(".") ? lower.slice(0, -1) : lower;
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

type CheckResult = { ok: true; url: URL } | { ok: false; reason: string };

// Shared DNS-resolved validation used by both `isAllowedUrlWithDns` (boolean)
// and `assertPublicHttpUrl` (throw-on-reject). Parseable http(s) URL, no
// embedded credentials, not an explicitly blocked hostname, and — for a
// literal IP — not private/reserved; for a hostname, resolves ALL A/AAAA
// records and rejects if any is private. Resolving every record prevents a
// host that mixes a public and a private address, and re-resolving at call
// time (rather than trusting an earlier/cached check) is what catches a host
// that DNS-rebinds to a private IP between validation and fetch. Use
// immediately before every outbound fetch to a user-controlled URL,
// including each redirect hop.
async function checkUrl(raw: string): Promise<CheckResult> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "URL must use http or https" };
  }
  // Reject userinfo (https://user:pass@host) — defends against credential
  // leakage and parser-ambiguity tricks in any downstream re-parse of the
  // raw string, even though `url.hostname` itself is already unambiguous.
  if (url.username || url.password) {
    return { ok: false, reason: "URL must not contain credentials" };
  }
  const host = url.hostname;
  if (!host) return { ok: false, reason: "URL has no host" };

  const bareHost = bareHostOf(host);
  if (BLOCKED_HOSTNAMES.has(bareHost)) {
    return { ok: false, reason: "URL host is a disallowed hostname" };
  }

  // Literal IP host — check directly, no DNS.
  if (net.isIP(bareHost)) {
    if (isBlockedIp(bareHost)) {
      return { ok: false, reason: "URL host is a private or reserved address" };
    }
    return { ok: true, url };
  }

  // Hostname — resolve ALL addresses and reject if any is private. Resolving
  // every record prevents a host that mixes a public and a private A record.
  let addrs: Array<{ address: string }>;
  try {
    addrs = await lookup(bareHost, { all: true });
  } catch {
    // Fail closed: if DNS doesn't resolve we can't prove it's safe.
    return { ok: false, reason: "URL host could not be resolved" };
  }
  if (addrs.length === 0) {
    return { ok: false, reason: "URL host did not resolve" };
  }
  for (const { address } of addrs) {
    if (isBlockedIp(address)) {
      return {
        ok: false,
        reason: "URL host resolves to a private or reserved address",
      };
    }
  }
  return { ok: true, url };
}

/**
 * DNS-resolved validation. Same rules as `checkUrl` — use immediately before
 * every outbound fetch to a user-controlled URL, including each redirect hop.
 */
export async function isAllowedUrlWithDns(urlString: string): Promise<boolean> {
  return (await checkUrl(urlString)).ok;
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
  const result = await checkUrl(rawUrl);
  if (!result.ok) throw new SsrfError(result.reason);
  return result.url;
}

/**
 * Fetch `url`, following redirects manually and re-validating each hop's
 * Location target against the SSRF allowlist (DNS-resolved) before
 * following it. Plain `fetch(url, { redirect: "follow" })` is unsafe for any
 * operator-supplied URL: the pre-flight `isAllowedUrlWithDns` check on the
 * original URL never sees a 3xx response's Location, so a tenant-controlled
 * host can 302 straight to the cloud metadata endpoint or an internal
 * service and the browser-level follow logic will happily land there.
 *
 * `init` is forwarded to every hop's `fetch()` call as-is (timeout/abort
 * signal, headers, method, ...) — callers own their own timeout/cancellation
 * exactly as before. `redirect` is always forced to "manual" regardless of
 * what's passed in `init`, since a caller can't validate a redirect it never
 * sees.
 *
 * Stops and returns the in-hand response (which may still be a 3xx) when a
 * non-redirect status is reached, the hop limit is hit, or a redirect
 * response has no Location header — same "give up gracefully" behavior the
 * hand-rolled per-caller loops had. Throws `SsrfError` if a redirect target
 * fails the allowlist check.
 */
export async function safeFetchFollowingRedirects(
  url: string,
  init: RequestInit = {},
  opts: { maxHops?: number } = {},
): Promise<Response> {
  const maxHops = opts.maxHops ?? 5;
  let currentUrl = url;
  let res: Response;
  for (let hop = 0; ; hop += 1) {
    res = await fetch(currentUrl, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && hop < maxHops) {
      const location = res.headers.get("location");
      if (!location) break;
      const next = new URL(location, currentUrl).toString();
      if (!(await isAllowedUrlWithDns(next))) {
        throw new SsrfError(`Redirect target is not allowed: ${next}`);
      }
      currentUrl = next;
      continue;
    }
    break;
  }
  return res;
}
