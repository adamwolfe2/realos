/**
 * SSRF protection utility.
 *
 * Two layers of defense:
 *   1. `isAllowedUrl(url)` — synchronous parse + hostname/IP rules. Rejects
 *      private/loopback/link-local IPs (v4 + v6), cloud metadata hostnames,
 *      and non-canonical IP encodings (octal, decimal). Used for fast
 *      validation of operator-provided URLs at form-submission time.
 *   2. `isAllowedUrlWithDns(url)` — async; runs the synchronous check first,
 *      then if the host is a DNS name, resolves all A/AAAA records and
 *      re-validates each address against the IP rules. This blocks
 *      DNS-rebinding attacks (attacker-controlled hostname pointing at
 *      127.0.0.1) and should be used immediately before any outbound
 *      `fetch()` to a user-controlled URL.
 */

import { isIP } from "node:net";
import { promises as dns, type LookupAddress } from "node:dns";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  // Cloud metadata services — almost always SSRF targets.
  "metadata",
  "metadata.google.internal",
  "metadata.aws.internal",
  "instance-data",
  "instance-data.ec2.internal",
]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return true; // not canonical → reject
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = nums;
  if (a === 0) return true; // 0.0.0.0/8 unspecified
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 169 && b === 254) return true; // link-local + AWS metadata
  if (a >= 224) return true; // multicast (224/4) + reserved (240/4) + 255.255.255.255
  return false;
}

function expandIPv6(ip: string): number[] | null {
  // Strip brackets if present and zone identifier (e.g. fe80::1%eth0).
  let addr = ip.replace(/^\[|\]$/g, "");
  const pct = addr.indexOf("%");
  if (pct !== -1) addr = addr.slice(0, pct);

  // Handle IPv4-mapped form like ::ffff:127.0.0.1 by converting trailing
  // dotted-quad into two hex groups.
  const lastColon = addr.lastIndexOf(":");
  if (lastColon !== -1 && addr.includes(".", lastColon)) {
    const tail = addr.slice(lastColon + 1);
    if (isIP(tail) === 4) {
      const parts = tail.split(".").map((n) => Number(n));
      if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
        return null;
      }
      const hexA = ((parts[0] << 8) | parts[1]).toString(16);
      const hexB = ((parts[2] << 8) | parts[3]).toString(16);
      addr = `${addr.slice(0, lastColon + 1)}${hexA}:${hexB}`;
    }
  }

  const doubleColonParts = addr.split("::");
  if (doubleColonParts.length > 2) return null;
  const head = doubleColonParts[0] === "" ? [] : doubleColonParts[0].split(":");
  const tail =
    doubleColonParts.length === 2
      ? doubleColonParts[1] === ""
        ? []
        : doubleColonParts[1].split(":")
      : [];
  const missing = 8 - head.length - tail.length;
  if (doubleColonParts.length === 1 && head.length !== 8) return null;
  if (doubleColonParts.length === 2 && missing < 0) return null;
  const groups = [
    ...head,
    ...Array(doubleColonParts.length === 2 ? missing : 0).fill("0"),
    ...tail,
  ];
  if (groups.length !== 8) return null;
  const nums: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    nums.push(parseInt(g, 16));
  }
  return nums;
}

function isPrivateIPv6(ip: string): boolean {
  const groups = expandIPv6(ip);
  if (!groups) return true; // can't parse → reject defensively
  // Unspecified ::
  if (groups.every((g) => g === 0)) return true;
  // Loopback ::1
  if (
    groups.slice(0, 7).every((g) => g === 0) &&
    groups[7] === 1
  ) {
    return true;
  }
  // IPv4-mapped ::ffff:a.b.c.d → groups[0..4]=0, groups[5]=0xffff, last 32 bits = IPv4
  if (
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff
  ) {
    const a = (groups[6] >> 8) & 0xff;
    const b = groups[6] & 0xff;
    const c = (groups[7] >> 8) & 0xff;
    const d = groups[7] & 0xff;
    return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
  }
  // ULA fc00::/7 — first byte has top 7 bits = 1111110 (0xfc or 0xfd)
  const firstByte = (groups[0] >> 8) & 0xff;
  if ((firstByte & 0xfe) === 0xfc) return true;
  // Link-local fe80::/10 — first 10 bits = 1111111010
  if ((groups[0] & 0xffc0) === 0xfe80) return true;
  return false;
}

function isPrivateAddress(host: string): boolean {
  const kind = isIP(host);
  if (kind === 4) return isPrivateIPv4(host);
  if (kind === 6) return isPrivateIPv6(host);
  return false;
}

export function isAllowedUrl(urlString: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }

  // Reject userinfo (https://user:pass@host) — defends against credential
  // smuggling and parser ambiguities.
  if (parsed.username || parsed.password) return false;

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  // Strip brackets that URL retains for IPv6 literals.
  const rawHost = parsed.hostname.toLowerCase();
  const host = rawHost.replace(/^\[|\]$/g, "");
  if (!host) return false;

  if (BLOCKED_HOSTNAMES.has(host)) return false;

  const ipKind = isIP(host);
  if (ipKind !== 0) {
    // Canonical IP literal — apply IP rules directly.
    return !isPrivateAddress(host);
  }

  // Not a canonical IP. Reject any all-digits or 0x.../0... encoded host that
  // browsers/Node would otherwise interpret as a numeric IP (e.g. 2130706433
  // = 127.0.0.1, 017700000001 = 127.0.0.1, 0x7f000001 = 127.0.0.1). A real
  // hostname always has at least one alphabetic char in some label.
  if (/^[0-9]+$/.test(host)) return false;
  if (/^0x[0-9a-f]+$/.test(host)) return false;
  // Reject hostnames whose dotted parts are all numeric/octal/hex (covers
  // partial IP encodings like "0177.0.0.1").
  const labels = host.split(".");
  if (
    labels.length > 1 &&
    labels.every((l) => /^(0x[0-9a-f]+|[0-9]+)$/.test(l))
  ) {
    return false;
  }

  return true;
}

export async function isAllowedUrlWithDns(urlString: string): Promise<boolean> {
  if (!isAllowedUrl(urlString)) return false;

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  // If the host is already a literal IP, isAllowedUrl already validated it.
  if (isIP(host) !== 0) return true;

  let records: LookupAddress[];
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    // Fail closed: if DNS doesn't resolve we can't prove it's safe.
    return false;
  }
  if (!records.length) return false;
  for (const r of records) {
    if (isPrivateAddress(r.address)) return false;
  }
  return true;
}
