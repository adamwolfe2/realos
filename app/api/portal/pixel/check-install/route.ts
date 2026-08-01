import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import {
  propertyWhereFragment,
  propertyOrOrgLevelWhereFragment,
} from "@/lib/tenancy/property-filter";
import { prisma } from "@/lib/db";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { isAllowedUrlWithDns } from "@/lib/utils/ssrf-protection";
import { detectPixelInstall } from "@/lib/pixel/detect-install";
import { checkRateLimit, rateLimited, seoSyncLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Bounded-concurrency probing (see CONCURRENCY below) keeps
// MAX_PIXELS_PER_CHECK targets well under Vercel's Pro 60s default even on
// a force=1 cold-cache run, but export it explicitly so a platform/plan
// change doesn't silently reintroduce the timeout — matches the sibling
// multi-property probe at app/api/portal/reputation/scan/route.ts.
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// GET /api/portal/pixel/check-install  (Slice 1b, extended Wave 3 Phase 8)
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
//
// Wave 3 Phase 8: a multi-property tenant can have one CursiveIntegration
// row per property, each on its own domain. Probing only the single most-
// recently-updated row (the old behavior) silently hid every other
// property's install status. This now probes every pixel row for the org
// (capped ~25 — CursiveIntegration is unique on (orgId, propertyId), so a
// tenant would need 25 buildings each with their own pixel to hit it) and
// returns a `results` array keyed by propertyId. The top-level fields are
// kept identical to the old single-result shape (mirroring the most
// recently updated row) so the existing consumer doesn't break; it also
// renders the per-property breakdown when there's more than one row.
//
// RBAC: the pixel query and the fallback property lookup are both gated by
// scope.allowedPropertyIds via propertyOrOrgLevelWhereFragment / the "id"
// field variant of propertyWhereFragment — a property-restricted user must
// only see their own building's row(s) plus true org-wide (propertyId
// NULL) pixels, mirroring app/portal/visitors/[id]/page.tsx's treatment of
// NULL-scoped rows for the same reason (legacy org-wide pixel install is
// not any one building's secret).
//
// Probing runs with bounded concurrency (CONCURRENCY at a time) instead of
// serially so a 25-target `?force=1` request can't approach the platform
// function-duration limit, and is rate-limited per org so it can't be used
// to drive unbounded outbound request volume.
// ---------------------------------------------------------------------------

const MAX_PIXELS_PER_CHECK = 25;
const CONCURRENCY = 5;
// Re-validate each redirect hop's target against the SSRF allowlist before
// following it — `redirect: "follow"` would let a tenant-controlled host
// 302 to an internal address that the pre-flight check on the ORIGINAL url
// never saw. Cap matches lib/property-images/scrape.ts.
const MAX_REDIRECTS = 3;

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

interface PerPropertyCheckResult extends CheckResult {
  propertyId: string | null;
  propertyName: string | null;
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
  let finalUrl = resolved.toString();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    let currentUrl = resolved.toString();
    // Manual redirect handling, per-hop re-validated against the SSRF
    // allowlist — see the MAX_REDIRECTS comment above.
    for (let hop = 0; ; hop += 1) {
      res = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LeaseStack-PixelProbe/1.0; +https://www.leasestack.co)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (res.status >= 300 && res.status < 400 && hop < MAX_REDIRECTS) {
        const location = res.headers.get("location");
        if (!location) break;
        const next = new URL(location, currentUrl).toString();
        if (!(await isAllowedUrlWithDns(next))) {
          clearTimeout(timeout);
          return {
            ok: false,
            url: currentUrl,
            status: "FETCH_FAILED",
            message: "This URL isn't allowed to be probed.",
            detectedPixelId: null,
          };
        }
        currentUrl = next;
        continue;
      }
      break;
    }
    finalUrl = currentUrl;
    clearTimeout(timeout);
    if (!res.ok) {
      return {
        ok: false,
        url: finalUrl,
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
      url: finalUrl,
      status: "FETCH_FAILED",
      message:
        msg.includes("abort") || msg.includes("timeout")
          ? "The site took too long to respond (>8s). It may be slow or unreachable from our server."
          : "Couldn't reach the website. It may be offline, behind auth, or blocking automated requests.",
      detectedPixelId: null,
    };
  }

  return { url: finalUrl, ...detectPixelInstall(html, expectedPixelId) };
}

function makeCachedProbe(url: string, expectedPixelId: string | null) {
  return unstable_cache(
    () => probeUrl(url, expectedPixelId),
    ["pixel-install-probe", url, expectedPixelId ?? "none"],
    { revalidate: 300, tags: ["pixel-install-probe"] },
  );
}

type ProbeTarget = {
  propertyId: string | null;
  propertyName: string | null;
  url: string | null;
  expectedPixelId: string | null;
};

async function probeTarget(
  target: ProbeTarget,
  force: boolean,
  checkedAt: string,
): Promise<PerPropertyCheckResult> {
  if (!target.url) {
    return {
      propertyId: target.propertyId,
      propertyName: target.propertyName,
      ok: false,
      url: null,
      status: "NO_URL",
      message: "No website URL on file for this property.",
      detectedPixelId: null,
      checkedAt,
    };
  }

  // SSRF guard — DNS-resolve and reject private/metadata targets on the
  // initial URL. Redirect hops get the same check inside probeUrl. One
  // disallowed property URL marks just that row FETCH_FAILED rather than
  // failing the whole multi-property check.
  const allowed = await isAllowedUrlWithDns(target.url);
  if (!allowed) {
    return {
      propertyId: target.propertyId,
      propertyName: target.propertyName,
      ok: false,
      url: target.url,
      status: "FETCH_FAILED",
      message: "This URL isn't allowed to be probed.",
      detectedPixelId: null,
      checkedAt,
    };
  }

  const inner = await (force
    ? probeUrl(target.url, target.expectedPixelId)
    : makeCachedProbe(target.url, target.expectedPixelId)());

  return {
    propertyId: target.propertyId,
    propertyName: target.propertyName,
    ...inner,
    checkedAt,
  };
}

async function probeAllTargets(
  targets: ProbeTarget[],
  force: boolean,
  checkedAt: string,
): Promise<PerPropertyCheckResult[]> {
  const results: PerPropertyCheckResult[] = [];
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((target) => probeTarget(target, force, checkedAt)),
    );
    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];
      if (outcome.status === "fulfilled") {
        results.push(outcome.value);
        continue;
      }
      const target = batch[j];
      console.error("[pixel/check-install] probe threw:", outcome.reason);
      results.push({
        propertyId: target.propertyId,
        propertyName: target.propertyName,
        ok: false,
        url: target.url,
        status: "FETCH_FAILED",
        message: "Couldn't reach the website.",
        detectedPixelId: null,
        checkedAt,
      });
    }
  }
  return results;
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
  const checkedAt = new Date().toISOString();

  // force=1 bypasses the 5-min per-URL cache, so it's the path that can
  // actually drive unbounded outbound request volume — rate-limit it the
  // same way the SEO on-demand sync route rate-limits its own on-demand
  // trigger. Cached (non-force) requests stay unlimited; the cache itself
  // already bounds their egress.
  if (force) {
    const { allowed } = await checkRateLimit(
      seoSyncLimiter,
      `pixel-check:${scope.orgId}`,
    );
    if (!allowed) {
      return rateLimited(
        "A pixel check was just triggered for this org. Try again in a minute.",
        60,
      );
    }
  }

  // SECURITY: every probe target is derived STRICTLY from the caller's own
  // org records — never from a request-supplied ?url. Accepting a caller
  // URL would turn this into an authenticated egress proxy / host scanner
  // (the DNS guard blocks private IPs but not arbitrary public hosts).
  // Every host we fetch must already be on file as this org's own site.
  //
  // Property-restricted users only see their own property's pixel rows
  // plus true org-wide (propertyId NULL) rows — mirrors how
  // app/portal/visitors/[id]/page.tsx treats NULL-scoped rows for the same
  // model family (a legacy org-wide pixel isn't any one building's data).
  const pixels = await prisma.cursiveIntegration.findMany({
    where: {
      orgId: scope.orgId,
      cursivePixelId: { not: null },
      ...propertyOrOrgLevelWhereFragment(scope, null),
    },
    select: {
      propertyId: true,
      cursivePixelId: true,
      installedOnDomain: true,
      property: { select: { name: true, websiteUrl: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: MAX_PIXELS_PER_CHECK,
  });

  // No pixel rows at all (fresh org) — fall back to any property with a
  // website on file so the operator gets a useful NOT_DETECTED/FETCH_FAILED
  // instead of a bare "no pixel". Single result, propertyId attached so it
  // still fits the per-property shape. Gated by the same access fragment
  // (field "id" here since we're filtering Property directly).
  let targets: ProbeTarget[] = pixels.map((p) => ({
    propertyId: p.propertyId,
    propertyName: p.property?.name ?? null,
    // A row can have cursivePixelId set but installedOnDomain still null
    // (pixel provisioned, domain not yet recorded — e.g. admin/legacy
    // fulfillment via lib/actions/admin-cursive.ts). Fall back to the
    // linked property's own websiteUrl so that row still gets a real
    // DETECTED_OK/NOT_DETECTED probe instead of a flat NO_URL.
    url: p.installedOnDomain
      ? `https://${p.installedOnDomain}`
      : p.property?.websiteUrl ?? null,
    expectedPixelId: p.cursivePixelId,
  }));

  if (targets.length === 0) {
    const firstWithUrl = await prisma.property.findFirst({
      where: {
        ...marketablePropertyWhere(scope.orgId),
        ...propertyWhereFragment(scope, null, "id"),
        websiteUrl: { not: null },
      },
      select: { id: true, name: true, websiteUrl: true },
      orderBy: { updatedAt: "desc" },
    });
    if (firstWithUrl) {
      targets = [
        {
          propertyId: firstWithUrl.id,
          propertyName: firstWithUrl.name,
          url: firstWithUrl.websiteUrl,
          expectedPixelId: null,
        },
      ];
    }
  }

  if (targets.length === 0) {
    const result: CheckResult = {
      ok: false,
      url: null,
      status: "NO_URL",
      message:
        "No website URL on file. Add your site URL (Organization or a Property) so we know where to look for the pixel.",
      detectedPixelId: null,
      checkedAt,
    };
    return NextResponse.json(result, { status: 200 });
  }

  const results = await probeAllTargets(targets, force, checkedAt);

  // Backward-compatible top-level fields mirror the single most recently
  // updated row (results[0], same ordering the old single-probe query
  // used) — the pre-Phase-8 consumer only ever read these. Multi-property
  // orgs additionally get the full `results` breakdown.
  const summary = results[0];
  const body = {
    ok: summary.ok,
    url: summary.url,
    status: summary.status,
    message: summary.message,
    detectedPixelId: summary.detectedPixelId,
    checkedAt,
    results,
  };
  return NextResponse.json(body, { status: 200 });
}
