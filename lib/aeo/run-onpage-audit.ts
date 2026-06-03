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

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
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
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error(
      `[aeo.onpage] direct fetch failed for ${url}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
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
