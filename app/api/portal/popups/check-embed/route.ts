import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { isAllowedUrlWithDns } from "@/lib/utils/ssrf-protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/portal/popups/check-embed
//
// Tenant-scoped embed-detection probe. Visits the operator's marketing
// website server-side, looks for the LeaseStack popup embed script, and
// reports back which of three states applies:
//
//   - detected, correct slug    → embed is wired and will fetch THIS org's
//                                  popup config
//   - detected, wrong slug      → embed is on the site but pointed at a
//                                  different tenant (paste error)
//   - not detected              → embed snippet hasn't been pasted yet
//
// Catches the #1 cause of "I made a popup but I don't see it on my site":
// the operator forgot to paste the embed snippet (or pasted it with a
// mismatched data-tenant attribute). The same probe powers both the
// inline status chip in the campaign editor and the troubleshoot card
// shown when an active popup has zero impressions.
//
// Results are cached per-URL via unstable_cache (5min TTL) so an operator
// rapid-clicking around the popup list doesn't fan out into N concurrent
// scrapes of their own site.
// ---------------------------------------------------------------------------

interface CheckResult {
  ok: boolean;
  url: string | null;
  status: "DETECTED_OK" | "DETECTED_WRONG_SLUG" | "NOT_DETECTED" | "NO_URL" | "FETCH_FAILED";
  message: string;
  detectedSlug: string | null;
  checkedAt: string;
}

// 8s HTTP timeout — the operator's marketing site should respond fast, but
// we don't want a slow/dead site to hang the portal request indefinitely.
const FETCH_TIMEOUT_MS = 8_000;

// Cap how much HTML we read — popup snippet is almost always in <head>,
// so the first 200KB is plenty. Protects against accidentally streaming
// a 10MB single-page-app payload through the route handler.
const MAX_HTML_BYTES = 200_000;

async function probeUrl(url: string, expectedSlug: string): Promise<Omit<CheckResult, "checkedAt">> {
  let resolved: URL;
  try {
    resolved = new URL(url);
  } catch {
    return {
      ok: false,
      url,
      status: "NO_URL",
      message: "Website URL is malformed — fix it on the Organization or Property record before re-checking.",
      detectedSlug: null,
    };
  }
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    return {
      ok: false,
      url,
      status: "NO_URL",
      message: "Website URL must use http or https.",
      detectedSlug: null,
    };
  }

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(resolved.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Some sites serve different markup to bots — claim a real UA
        // so we see the snippet a real visitor would see.
        "User-Agent":
          "Mozilla/5.0 (compatible; LeaseStack-EmbedProbe/1.0; +https://www.leasestack.co)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return {
        ok: false,
        url: resolved.toString(),
        status: "FETCH_FAILED",
        message: `Couldn't reach the website (HTTP ${res.status}). It may be offline or behind auth.`,
        detectedSlug: null,
      };
    }
    // Read only the first MAX_HTML_BYTES — most embeds live in <head>.
    const reader = res.body?.getReader();
    if (!reader) {
      html = await res.text();
    } else {
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      while (bytes < MAX_HTML_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        bytes += value.byteLength;
      }
      // Best-effort abort the rest of the body.
      try { reader.cancel(); } catch { /* ignore */ }
      html = new TextDecoder().decode(new Uint8Array(
        chunks.reduce<number[]>((acc, c) => {
          for (let i = 0; i < c.length; i++) acc.push(c[i]);
          return acc;
        }, []),
      ));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      url: resolved.toString(),
      status: "FETCH_FAILED",
      message:
        msg.includes("abort") || msg.includes("timeout")
          ? "The site took too long to respond (>8s). It may be slow or unreachable from our server."
          : `Couldn't reach the website: ${msg}`,
      detectedSlug: null,
    };
  }

  // Look for any LeaseStack popup embed script — match on the popup.js
  // path so we catch both leasestack.co + www.leasestack.co + any custom
  // CDN proxy an operator might set up.
  const scriptMatch = html.match(
    /<script[^>]+src=["'][^"']*\/embed\/popup\.js["'][^>]*>/i,
  );
  if (!scriptMatch) {
    return {
      ok: false,
      url: resolved.toString(),
      status: "NOT_DETECTED",
      message:
        "The popup embed script isn't on this page. Paste the install snippet into your site's <head> (or the equivalent CMS hook).",
      detectedSlug: null,
    };
  }

  // Parse the data-tenant attribute off the matched script tag.
  const slugMatch = scriptMatch[0].match(/data-tenant=["']([^"']+)["']/i);
  const detectedSlug = slugMatch ? slugMatch[1] : null;
  if (!detectedSlug) {
    return {
      ok: false,
      url: resolved.toString(),
      status: "NOT_DETECTED",
      message:
        "Found the embed script but it's missing the data-tenant attribute. Re-copy the snippet from this page so the slug is included.",
      detectedSlug: null,
    };
  }
  if (detectedSlug !== expectedSlug) {
    return {
      ok: false,
      url: resolved.toString(),
      status: "DETECTED_WRONG_SLUG",
      message: `Embed is on the site but points at the wrong tenant ("${detectedSlug}"). Replace it with the snippet below (your slug: "${expectedSlug}").`,
      detectedSlug,
    };
  }

  return {
    ok: true,
    url: resolved.toString(),
    status: "DETECTED_OK",
    message: "Embed snippet detected and pointing at this org. Popups will fire on real visitors when their trigger conditions are met.",
    detectedSlug,
  };
}

// 5-min cache keyed on (url, expectedSlug) — same probe re-run by every
// operator viewing the same campaign editor in a 5-min window collapses
// to a single outbound request. Bust by passing ?force=1.
function makeCachedProbe(url: string, expectedSlug: string) {
  return unstable_cache(
    () => probeUrl(url, expectedSlug),
    ["popup-embed-probe", url, expectedSlug],
    { revalidate: 300, tags: ["popup-embed-probe"] },
  );
}

export async function GET(req: NextRequest) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const urlOverride = req.nextUrl.searchParams.get("url");

  // Resolve the URL we'll probe. Priority:
  //   1. explicit ?url=... query param (matches the campaign's targeted
  //      property's websiteUrl — the campaign editor passes this in)
  //   2. the first marketable property's websiteUrl on this org
  //
  // We DON'T fall back to a synthetic "guess the URL from slug" because
  // a wrong guess would falsely report NOT_DETECTED and confuse the
  // operator. Better to surface NO_URL and prompt them to configure it.
  const [org] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { slug: true },
    }),
  ]);
  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  let probeTarget: string | null = urlOverride;
  if (!probeTarget) {
    const firstWithUrl = await prisma.property.findFirst({
      where: { ...marketablePropertyWhere(scope.orgId), websiteUrl: { not: null } },
      select: { websiteUrl: true },
      orderBy: { updatedAt: "desc" },
    });
    probeTarget = firstWithUrl?.websiteUrl ?? null;
  }

  if (!probeTarget) {
    const result: CheckResult = {
      ok: false,
      url: null,
      status: "NO_URL",
      message:
        "No website URL configured. Set the Public Website URL on at least one property so we know where to look for the embed.",
      detectedSlug: null,
      checkedAt: new Date().toISOString(),
    };
    return NextResponse.json(result, { status: 200 });
  }

  // SSRF guard — resolve DNS and reject if the URL points at a private/
  // metadata IP (or any A/AAAA record does). Defends against operator-
  // supplied URLs like http://169.254.169.254/... and DNS-rebinding hosts
  // that pivot to internal services after passing the sync URL/IP check.
  const allowed = await isAllowedUrlWithDns(probeTarget);
  if (!allowed) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
  }

  const probe = force
    ? probeUrl(probeTarget, org.slug)
    : makeCachedProbe(probeTarget, org.slug)();
  const inner = await probe;

  const result: CheckResult = { ...inner, checkedAt: new Date().toISOString() };
  return NextResponse.json(result, { status: 200 });
}
