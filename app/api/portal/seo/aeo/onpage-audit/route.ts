import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireScope,
  requireWritableWorkspace,
  ForbiddenError,
} from "@/lib/tenancy/scope";
import { runOnPageAudit } from "@/lib/aeo/run-onpage-audit";
import {
  orgHasActiveAddon,
  ADDON_AEO_BOOST,
} from "@/lib/proposals/org-addons";

// Tiny in-memory rate bucket — same pattern the other on-demand
// endpoints use. Per-org sliding window: max 5 audits per minute.
// In-process state survives across requests on a warm lambda; cold
// starts reset the bucket (acceptable: the addon gate is the primary
// abuse barrier; this is defense in depth for chatty operators).
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateBuckets = new Map<string, number[]>();

function checkRateLimit(orgId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const bucket = (rateBuckets.get(orgId) ?? []).filter((t) => t > cutoff);
  if (bucket.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(orgId, bucket);
    return false;
  }
  bucket.push(now);
  rateBuckets.set(orgId, bucket);
  return true;
}

// ---------------------------------------------------------------------------
// POST /api/portal/seo/aeo/onpage-audit
//
// Gated AEO OnPage audit. Available only to orgs with the AEO Boost
// $199/mo add-on. Returns the per-check breakdown + 0-100 score.
//
// Body: { url: string }
//
// Auth: requireScope() — caller must belong to the tenant org.
// Gate:  orgHasActiveAddon(orgId, ADDON_AEO_BOOST) — 402 otherwise so the
//        client can show an upgrade hook.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  url: z
    .string()
    .min(3, "URL is too short")
    .max(500, "URL is too long"),
  propertyId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let scope: Awaited<ReturnType<typeof requireScope>>;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  // Agency owners (LeaseStack internal — Adam) bypass the addon gate so
  // they can audit any tenant org without holding the AEO Boost line on
  // their own account. Client orgs go through the normal addon check.
  const hasAddon =
    scope.role === "AGENCY_OWNER"
      ? true
      : await orgHasActiveAddon(scope.orgId, ADDON_AEO_BOOST);
  if (!hasAddon) {
    return NextResponse.json(
      {
        error:
          "AEO OnPage audit requires the AEO Boost add-on. Add it to your subscription to unlock per-page audits.",
        upgradeUrl: "/portal/billing",
        gated: true,
      },
      { status: 402 },
    );
  }

  // Per-org sliding-window rate limit. Skipped for AGENCY_OWNER (Adam)
  // since internal QA shouldn't get throttled.
  if (scope.role !== "AGENCY_OWNER" && !checkRateLimit(scope.orgId)) {
    return NextResponse.json(
      {
        error: `Rate limit: ${RATE_LIMIT_MAX} audits per minute. Try again shortly.`,
      },
      { status: 429 },
    );
  }

  const result = await runOnPageAudit({
    orgId: scope.orgId,
    url: parsed.data.url,
    propertyId: parsed.data.propertyId ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    auditRowId: result.auditRowId,
    source: result.source,
    score: result.audit.score,
    checks: result.audit.checks,
    excerpt: result.audit.excerpt,
  });
}
