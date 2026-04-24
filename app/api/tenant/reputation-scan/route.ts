import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  auditPayload,
  tenantWhere,
} from "@/lib/tenancy/scope";
import {
  checkRateLimit,
  rateLimited,
  reputationScanLimiter,
} from "@/lib/rate-limit";
import { AuditAction } from "@prisma/client";
import { orchestrateScan } from "@/lib/reputation/orchestrate";
import type { PropertySeed, ScanProgressEvent } from "@/lib/reputation/types";

// ---------------------------------------------------------------------------
// POST /api/tenant/reputation-scan
//
// On-demand reputation scan for a single property. Streams SSE events back
// to the client while the orchestrator fans out to Tavily, Google Places,
// Reddit, and Yelp, then runs Claude Haiku classification on the results.
//
// Rate limits:
//   - 3 scans per user per hour (reputationScanLimiter, Redis-backed)
//   - 20 scans per org per day (Prisma count in this handler)
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ORG_DAILY_CAP = 20;

const bodySchema = z.object({
  propertyId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let scope: Awaited<ReturnType<typeof requireScope>>;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Per-user rate limit.
  const { allowed, reset } = await checkRateLimit(
    reputationScanLimiter,
    `reputation-scan:${scope.userId}`
  );
  if (!allowed) {
    const retry = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return rateLimited(
      "You've hit the reputation-scan rate limit (3 per hour). Try again soon.",
      retry
    );
  }

  // Per-org daily cap.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const orgCount = await prisma.reputationScan.count({
    where: {
      ...tenantWhere(scope),
      createdAt: { gte: since },
    },
  });
  if (orgCount >= ORG_DAILY_CAP) {
    return rateLimited(
      `This workspace has hit the daily reputation-scan cap (${ORG_DAILY_CAP} per 24h).`,
      60 * 60
    );
  }

  // Load the property and verify tenant ownership.
  const property = await prisma.property.findFirst({
    where: { id: parsed.data.propertyId, ...tenantWhere(scope) },
    select: {
      id: true,
      orgId: true,
      name: true,
      addressLine1: true,
      city: true,
      state: true,
      postalCode: true,
      googlePlaceId: true,
      googleReviewUrl: true,
      yelpBusinessId: true,
      redditSubreddits: true,
    },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Audit the scan initiation. We write this synchronously so we always have
  // a record even if the stream is aborted mid-flight.
  await prisma.auditEvent
    .create({
      data: auditPayload(scope, {
        action: AuditAction.CREATE,
        entityType: "ReputationScan",
        entityId: property.id,
        description: `Reputation scan started for property ${property.name}`,
      }),
    })
    .catch(() => {
      // Audit write failure should not block the scan.
    });

  const seed: PropertySeed = {
    id: property.id,
    orgId: property.orgId,
    name: property.name,
    addressLine1: property.addressLine1,
    city: property.city,
    state: property.state,
    postalCode: property.postalCode,
    googlePlaceId: property.googlePlaceId,
    googleReviewUrl: property.googleReviewUrl,
    yelpBusinessId: property.yelpBusinessId,
    redditSubreddits: Array.isArray(property.redditSubreddits)
      ? (property.redditSubreddits as string[])
      : null,
  };

  // Build the SSE ReadableStream.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: ScanProgressEvent) => {
        const name = event.type;
        const chunk = `event: ${name}\ndata: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      };

      try {
        for await (const evt of orchestrateScan({
          property: seed,
          triggeredByUserId: scope.userId,
        })) {
          write(evt);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        write({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
