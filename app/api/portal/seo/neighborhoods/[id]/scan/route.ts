import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireScope,
  requireWritableWorkspace,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { runNeighborhoodScan } from "@/lib/aeo/orchestrate";

// ---------------------------------------------------------------------------
// POST /api/portal/seo/neighborhoods/[id]/scan
//
// Runs a targeted AEO scan against a single NeighborhoodPage's
// aiCitations[]. Auth = portal scope (any role can trigger — the page must
// already exist in their org). Rate-limited to 1 scan / hour / page so a
// twitchy operator can't burn engine quotas re-checking the same page.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SCAN_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let scope: Awaited<ReturnType<typeof requireScope>>;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Ownership check — page must belong to the caller's effective org.
  const page = await prisma.neighborhoodPage.findFirst({
    where: { id, orgId: scope.orgId },
    select: { id: true, orgId: true },
  });
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const cutoff = new Date(Date.now() - SCAN_COOLDOWN_MS);
  const recent = await prisma.aeoCitationCheck.count({
    where: {
      ...tenantWhere(scope),
      neighborhoodPageId: page.id,
      queryRunAt: { gte: cutoff },
    },
  });
  if (recent > 0) {
    return NextResponse.json(
      {
        error:
          "This page was scanned in the last hour. Please wait before re-scanning.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(SCAN_COOLDOWN_MS / 1000) },
      },
    );
  }

  try {
    const result = await runNeighborhoodScan({
      orgId: scope.orgId,
      pageId: page.id,
    });
    return NextResponse.json({
      ok: true,
      queriesRun: result.queriesRun,
      citedCount: result.citedCount,
      claimsScanned: result.claimsScanned,
      rowsWritten: result.rowsWritten,
      enginesUsed: result.enginesUsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[portal/seo/neighborhoods/scan] failed:",
      message,
    );
    return NextResponse.json(
      { error: "Scan failed", detail: message },
      { status: 500 },
    );
  }
}
