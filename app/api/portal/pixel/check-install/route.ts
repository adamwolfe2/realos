import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { isAllowedUrlWithDns } from "@/lib/utils/ssrf-protection";
import { detectPixelInstall } from "@/lib/pixel/detect-install";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/portal/pixel/check-install  (Slice 1b)
//
// Tenant-scoped install probe for the visitor-identification pixel. Visits the
// client's website server-side and confirms the Cursive/AudienceLab loader
// (cdn.idpixel.app/...idp-analytics-<pixelId>...) is actually present on the
// page — replacing the old "paste-and-pray" flow where the only signal that a
// pixel was live was a webhook eventually landing.
//
// States:
//   DETECTED_OK        → the loader is on the page (and matches this org's
//                        pixel id when we know it)
//   DETECTED_WRONG_PIXEL → an idpixel loader is present but for a different
//                        pixel id (paste error / wrong account)
//   NOT_DETECTED       → no idpixel loader on the page (snippet not installed)
//   NO_URL / FETCH_FAILED → couldn't resolve or reach the site
//
// Mirrors app/api/portal/popups/check-embed (same SSRF guard, byte cap,
// timeout, and 5-min per-URL cache) so the security posture is identical.
// ---------------------------------------------------------------------------

interface CheckResult {
  ok: boolean;
  url: string | null;
  status:
    | "DETECTED_OK"
    | "DETECTED_WRONG_PIXEL"
    | "NOT_DETECTED"
    | "NO_URL"
    | "FETCH_FAILED";
  message: string;
  detectedPixelId: string | null;
  checkedAt: string;
}

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 200_000;

async function probeUrl(
  url: string,
  expectedPixelId: string | null,
): Promise<Omit<CheckResult, "checkedAt">> {
  let resolved: URL;
  try {
    resolved = new URL(url);
  } catch {
    return {
      ok: false,
      url,
      status: "NO_URL",
      message: "Website URL is malformed — fix it before re-checking.",
      detectedPixelId: null,
    };
  }
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    return {
      ok: false,
      url,
      status: "NO_URL",
      message: "Website URL must use http or https.",
      detectedPixelId: null,
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
        "User-Agent":
          "Mozilla/5.0 (compatible; LeaseStack-PixelProbe/1.0; +https://www.leasestack.co)",
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
        detectedPixelId: null,
      };
    }
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
      try {
        reader.cancel();
      } catch {
        /* ignore */
      }
      html = new TextDecoder().decode(
        new Uint8Array(
          chunks.reduce<number[]>((acc, c) => {
            for (let i = 0; i < c.length; i++) acc.push(c[i]);
            return acc;
          }, []),
        ),
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Don't echo the raw Node error (ECONNREFUSED <ip>:<port>, TLS/cert
    // detail) back to the caller — it aids host reconnaissance. Log server-
    // side; return a generic reason to the client.
    console.error("[pixel/check-install] probe failed:", msg);
    return {
      ok: false,
      url: resolved.toString(),
      status: "FETCH_FAILED",
      message:
        msg.includes("abort") || msg.includes("timeout")
          ? "The site took too long to respond (>8s). It may be slow or unreachable from our server."
          : "Couldn't reach the website. It may be offline, behind auth, or blocking automated requests.",
      detectedPixelId: null,
    };
  }

  return { url: resolved.toString(), ...detectPixelInstall(html, expectedPixelId) };
}

function makeCachedProbe(url: string, expectedPixelId: string | null) {
  return unstable_cache(
    () => probeUrl(url, expectedPixelId),
    ["pixel-install-probe", url, expectedPixelId ?? "none"],
    { revalidate: 300, tags: ["pixel-install-probe"] },
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

  // SECURITY: the probe target is derived STRICTLY from the caller's own org
  // records — never from a request-supplied ?url. Accepting a caller URL would
  // turn this into an authenticated egress proxy / host scanner (the DNS guard
  // blocks private IPs but not arbitrary public hosts). Every host we fetch
  // must already be on file as this org's own site.
  const pixel = await prisma.cursiveIntegration.findFirst({
    where: { orgId: scope.orgId, cursivePixelId: { not: null } },
    select: { cursivePixelId: true, installedOnDomain: true },
    orderBy: { updatedAt: "desc" },
  });

  let probeTarget: string | null = null;
  if (pixel?.installedOnDomain) {
    probeTarget = `https://${pixel.installedOnDomain}`;
  }
  if (!probeTarget) {
    const firstWithUrl = await prisma.property.findFirst({
      where: {
        ...marketablePropertyWhere(scope.orgId),
        websiteUrl: { not: null },
      },
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
        "No website URL on file. Add your site URL (Organization or a Property) so we know where to look for the pixel.",
      detectedPixelId: null,
      checkedAt: new Date().toISOString(),
    };
    return NextResponse.json(result, { status: 200 });
  }

  // SSRF guard — DNS-resolve and reject private/metadata targets (and
  // rebinding hosts). Identical posture to the popup embed probe.
  const allowed = await isAllowedUrlWithDns(probeTarget);
  if (!allowed) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
  }

  const expectedPixelId = pixel?.cursivePixelId ?? null;
  const probe = force
    ? probeUrl(probeTarget, expectedPixelId)
    : makeCachedProbe(probeTarget, expectedPixelId)();
  const inner = await probe;

  const result: CheckResult = { ...inner, checkedAt: new Date().toISOString() };
  return NextResponse.json(result, { status: 200 });
}
