/**
 * OnPage AEO audit orchestrator. Fetches a URL via Firecrawl (with a
 * native-fetch fallback), runs the pure check pipeline, persists an
 * AeoOnPageAudit row.
 *
 * Gating: this function does NOT check the addon — that's the caller's
 * responsibility. Both the API route and the (future) cron worker
 * resolve `orgHasActiveAddon` themselves.
 */

import "server-only";
import { prisma } from "@/lib/db";
import { scrape as firecrawlScrape } from "@/lib/intelligence/firecrawl";
import { runOnPageAuditChecks, type OnPageAuditResult } from "./onpage-audit";
import type { Prisma } from "@prisma/client";

const FETCH_TIMEOUT_MS = 20_000;
/// Cap HTML body at 5 MB to prevent a giant response OOM-ing the
/// lambda. Real-world AI-citation candidates are well under this; an
/// audit target with >5 MB of HTML almost certainly has other problems.
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * SSRF guard. Reject any URL whose resolved hostname falls inside the
 * cloud-metadata / loopback / private-network ranges. We can't do real
 * DNS resolution before fetch without extra setup, so we apply a
 * hostname-level deny pattern that covers the common cases (RFC 1918,
 * localhost, link-local, cloud metadata). Defense in depth — Vercel
 * Functions also block 169.254.0.0/16 by default, but we don't want to
 * rely on that.
 */
const PRIVATE_HOSTNAME_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, // link-local / cloud metadata
  /^100\.6[4-9]\./, /^100\.[7-9]\d\./, /^100\.1[01]\d\./, /^100\.12[0-7]\./, // CGNAT 100.64.0.0/10
  /^fc[0-9a-f]{2}:/i, /^fd[0-9a-f]{2}:/i, // IPv6 ULA
  /^fe80:/i, // IPv6 link-local
  /^::1$/, // IPv6 loopback (brackets stripped before match)
  /^\[::1\]?$/i, // IPv6 loopback fallback
  /^metadata\.google\.internal$/i,
];

export interface RunOnPageAuditInput {
  orgId: string;
  url: string;
  propertyId?: string | null;
}

export type RunOnPageAuditResult =
  | {
      ok: true;
      audit: OnPageAuditResult;
      auditRowId: string;
      source: "firecrawl" | "fetch";
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Exported for unit tests. The function returns the normalized URL when
 * safe to fetch, null when blocked (protocol, parse failure, or hostname
 * matches a private/loopback/metadata pattern).
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // If the input already contains a scheme (anything before `://`), keep
  // it as-is so we can reject non-http(s) protocols below. Only prepend
  // https:// for bare hostnames like "example.com/foo". Without this
  // check, "file:///etc/passwd" got rewritten to "https://file:///etc/passwd"
  // which slipped past the http(s) gate.
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const u = new URL(candidate);
    // Only http(s). Reject file://, ftp://, gopher://, javascript:, etc.
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    // SSRF guard — reject hostnames that look like internal infrastructure.
    // URL parser preserves brackets around IPv6 hostnames in `.hostname`;
    // strip them before pattern matching so /^fe80:/ etc fire correctly.
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (PRIVATE_HOSTNAME_PATTERNS.some((re) => re.test(host))) return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function fetchHtmlDirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "LeaseStackAEOBot/1.0 (+https://www.leasestack.co/ — AEO audit)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Disable automatic redirect following so a 30x to a private
      // hostname doesn't bypass our SSRF guard. We'll re-fetch from the
      // Location header through normalizeUrl + this function if needed.
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      const next = normalizeUrl(new URL(loc, url).toString());
      if (!next || next === url) return null;
      // One redirect hop only — keeps the audit deterministic and bounds
      // the time budget. Real-world audit targets shouldn't need more.
      return fetchHtmlDirectOnce(next);
    }
    if (!res.ok) return null;
    return await readBodyWithCap(res);
  } catch (err) {
    console.error(
      `[aeo.onpage] direct fetch failed for ${url}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function fetchHtmlDirectOnce(url: string): Promise<string | null> {
  // Same as fetchHtmlDirect but without recursion — used for the
  // post-redirect single hop.
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "LeaseStackAEOBot/1.0 (+https://www.leasestack.co/ — AEO audit)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "manual",
    });
    if (!res.ok) return null;
    return await readBodyWithCap(res);
  } catch {
    return null;
  }
}

async function readBodyWithCap(res: Response): Promise<string | null> {
  // Bound the body size so a giant or streaming response can't OOM the
  // lambda. Bail at MAX_BYTES; the audit fails open (returns null) and
  // the orchestrator treats that as "no usable HTML".
  const reader = res.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > MAX_BYTES) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        return null;
      }
      chunks.push(value);
    }
  }
  const buf = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

export async function runOnPageAudit(
  input: RunOnPageAuditInput,
): Promise<RunOnPageAuditResult> {
  const url = normalizeUrl(input.url);
  if (!url) {
    return { ok: false, error: "URL could not be parsed" };
  }

  let html: string | null = null;
  let source: "firecrawl" | "fetch" = "fetch";

  // Tier 1: Firecrawl. Cached + costs accounted for inside the helper.
  const fc = await firecrawlScrape({ url, formats: ["html"] }).catch(
    () => null,
  );
  if (fc && fc.ok && fc.data.html) {
    html = fc.data.html;
    source = "firecrawl";
  } else {
    // Tier 2: native fetch. No cost, no cache. Used when Firecrawl is
    // unavailable / rate-limited / returns empty.
    html = await fetchHtmlDirect(url);
  }

  if (!html || html.length < 100) {
    return {
      ok: false,
      error: "Failed to fetch a usable HTML body for the URL",
    };
  }

  const audit = runOnPageAuditChecks(html);

  try {
    const row = await prisma.aeoOnPageAudit.create({
      data: {
        orgId: input.orgId,
        propertyId: input.propertyId ?? null,
        url,
        score: audit.score,
        checks: audit.checks as unknown as Prisma.InputJsonValue,
        excerpt: audit.excerpt,
      },
      select: { id: true },
    });
    return { ok: true, audit, auditRowId: row.id, source };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[aeo.onpage] persist failed for org ${input.orgId} / ${url}: ${message}`,
    );
    return {
      ok: false,
      error: `Persistence failed: ${message}`,
    };
  }
}
