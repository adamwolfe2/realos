import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  requireWritableWorkspace,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { orchestrateScan } from "@/lib/reputation/orchestrate";
import { backfillSentimentForOrg } from "@/lib/reputation/sentiment";
import type { PropertySeed } from "@/lib/reputation/types";
import {
  checkAiBillingGate,
  aiBillingDeniedResponseBody,
} from "@/lib/billing/gate";

// ---------------------------------------------------------------------------
// POST /api/portal/reputation/scan
//
// Portfolio-wide on-demand reputation scan. Wired to the "Scan now" button
// on /portal/reputation. Fans out across every marketable property in the
// caller's org (or a single property if `propertyId` is supplied), running
// the same per-property orchestrator used by /api/tenant/reputation-scan.
//
// This endpoint does NOT stream SSE — the unified dashboard refreshes the
// page after completion. For the streaming single-property variant, use
// /api/tenant/reputation-scan from a property detail tab.
//
// Rate limit:
//   * 1 portfolio scan per org per hour (Prisma count against
//     ReputationScan.createdAt). Independent from the per-property cron
//     and from /api/tenant/reputation-scan's per-user limit.
//   * Hard cap of 5 properties per portfolio run so a 200-property org
//     can't accidentally burn $20 of Tavily budget on a misclick.
//
// After the scans complete, also runs a small batch sentiment backfill
// pass so any mentions left unclassified by a partial-failure scan get
// picked up before the page reloads.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ORG_HOURLY_LIMIT = 1;
const MAX_PROPERTIES_PER_RUN = 5;

const bodySchema = z
  .object({
    // Optional — when omitted, we run the top-N most-recently-mentioned
    // marketable properties. When set, scope to a single property.
    propertyId: z.string().optional(),
  })
  .strict();

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

  let input: unknown = {};
  try {
    // Body is optional — Scan now button posts an empty body.
    const text = await req.text();
    if (text.trim().length > 0) input = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Billing gate — portfolio scans fan out to Tavily + Claude Haiku
  // across up to 5 properties per run. Block delinquent tenants.
  const billingGate = await checkAiBillingGate(scope.orgId, {
    isImpersonating: scope.isImpersonating,
  });
  if (!billingGate.allowed) {
    return NextResponse.json(aiBillingDeniedResponseBody(billingGate), {
      status: 402,
    });
  }

  // Per-org hourly cap. Implemented as a Prisma count rather than via Redis
  // so the limiter survives an Upstash outage — important because the
  // unified dashboard surfaces the Scan now button prominently.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentScanCount = await prisma.reputationScan.count({
    where: {
      ...tenantWhere(scope),
      createdAt: { gte: oneHourAgo },
    },
  });
  if (recentScanCount >= ORG_HOURLY_LIMIT) {
    const retryAfter = 60 * 60;
    return NextResponse.json(
      {
        error:
          "This workspace already ran a reputation scan in the last hour. Try again later.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  // Resolve target properties.
  const where = {
    ...marketablePropertyWhere(scope.orgId),
  };
  let propertyTargets: Array<PropertySeed> = [];

  if (parsed.data.propertyId) {
    const p = await prisma.property.findFirst({
      where: { id: parsed.data.propertyId, ...where },
      select: propertySelect,
    });
    if (!p) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 },
      );
    }
    propertyTargets = [toSeed(p)];
  } else {
    // Top-N marketable properties, newest first. We don't try to be clever
    // about "least-recently-scanned" — the per-org hourly limit already
    // throttles total volume, and operators have a single-property
    // "Scan now" on the property detail page for surgical re-runs.
    const rows = await prisma.property.findMany({
      where,
      select: propertySelect,
      orderBy: { createdAt: "desc" },
      take: MAX_PROPERTIES_PER_RUN,
    });
    propertyTargets = rows.map(toSeed);
  }

  if (propertyTargets.length === 0) {
    return NextResponse.json(
      { error: "No marketable properties to scan." },
      { status: 400 },
    );
  }

  // Run scans with a small concurrency cap rather than fully serial or
  // fully parallel. Each per-property scan fans out to the SAME external
  // APIs (Tavily, Google, Reddit, Yelp — see lib/reputation/orchestrate.ts),
  // so running all N properties at once would multiply concurrent calls to
  // those rate-limited APIs by N. A cap of 2 keeps us within a safe margin
  // of Tavily's free-tier concurrency limit while still finishing well
  // inside maxDuration for multi-property orgs (MAX_PROPERTIES_PER_RUN=5
  // serialized could otherwise approach/exceed the 60s route budget).
  const SCAN_CONCURRENCY = 2;
  type ScanResult = {
    propertyId: string;
    status: string;
    error?: string;
    /** Per-source failures the orchestrator yielded — populated so the
     * UI can surface "Yelp rate-limited" instead of swallowing it. */
    sourceErrors?: Array<{ source: string; error: string }>;
  };

  async function runScan(property: PropertySeed): Promise<ScanResult> {
    const sourceErrors: Array<{ source: string; error: string }> = [];
    try {
      // Drive the async generator to completion. We only care about the
      // final "done" event for the response payload.
      let finalStatus: string = "RUNNING";
      for await (const evt of orchestrateScan({
        property,
        triggeredByUserId: scope.userId,
      })) {
        if (evt.type === "done") finalStatus = evt.status;
        if (evt.type === "error") finalStatus = "FAILED";
        if (evt.type === "source_failed") {
          // Capture per-source failures (e.g. Tavily quota, Yelp 429) so
          // the operator can see why a scan returned thin results
          // instead of assuming everything was fine.
          sourceErrors.push({ source: evt.source, error: evt.error });
        }
      }
      return {
        propertyId: property.id,
        status: finalStatus,
        ...(sourceErrors.length > 0 ? { sourceErrors } : {}),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        propertyId: property.id,
        status: "FAILED",
        error: message,
        ...(sourceErrors.length > 0 ? { sourceErrors } : {}),
      };
    }
  }

  // Simple fixed-size worker pool — no new deps. Each worker pulls the
  // next property off the shared queue until it's drained, so results
  // preserve slot order but scans overlap up to SCAN_CONCURRENCY at once.
  const results: Array<ScanResult> = new Array(propertyTargets.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= propertyTargets.length) return;
      results[i] = await runScan(propertyTargets[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(SCAN_CONCURRENCY, propertyTargets.length) }, () =>
      worker(),
    ),
  );

  // Backfill sentiment on any rows the orchestrator persisted without a
  // sentiment label (e.g. due to a transient Claude error during the scan).
  // Best-effort — failure is logged but doesn't fail the response.
  let backfilled = 0;
  try {
    const b = await backfillSentimentForOrg(scope.orgId, { batchSize: 20 });
    backfilled = b.classified;
  } catch (err) {
    console.error("[portal/reputation/scan] backfill failed:", err);
  }

  return NextResponse.json({
    ok: true,
    scanned: results.length,
    backfilled,
    results,
  });
}

const propertySelect = {
  id: true,
  orgId: true,
  name: true,
  addressLine1: true,
  city: true,
  state: true,
  postalCode: true,
  propertyType: true,
  residentialSubtype: true,
  googlePlaceId: true,
  googleReviewUrl: true,
  yelpBusinessId: true,
  redditSubreddits: true,
} as const;

type PropertyRow = {
  id: string;
  orgId: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  propertyType: PropertySeed["propertyType"];
  residentialSubtype: PropertySeed["residentialSubtype"];
  googlePlaceId: string | null;
  googleReviewUrl: string | null;
  yelpBusinessId: string | null;
  redditSubreddits: unknown;
};

function toSeed(p: PropertyRow): PropertySeed {
  return {
    id: p.id,
    orgId: p.orgId,
    name: p.name,
    addressLine1: p.addressLine1,
    city: p.city,
    state: p.state,
    postalCode: p.postalCode,
    propertyType: p.propertyType,
    residentialSubtype: p.residentialSubtype,
    googlePlaceId: p.googlePlaceId,
    googleReviewUrl: p.googleReviewUrl,
    yelpBusinessId: p.yelpBusinessId,
    redditSubreddits: Array.isArray(p.redditSubreddits)
      ? (p.redditSubreddits as string[])
      : null,
  };
}
