import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/portal/seo/scan/[propertyId]/status
//
// Cheap polling endpoint the operator UI hits every 3-5s while the
// first scan is running. Returns a coverage snapshot: how many SERP
// rankings, audits, backlinks, and competitor rows we have for this
// property today.
//
// UI uses this to show progress ("scanned 2/4 queries, Lighthouse
// complete, fetching competitors...") and to know when to refresh
// the full dashboard.
// ---------------------------------------------------------------------------

function todayUtcStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ propertyId: string }> },
) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const { propertyId } = await ctx.params;

  if (scope.allowedPropertyIds && !scope.allowedPropertyIds.includes(propertyId)) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const property = await prisma.property.findFirst({
    where: { id: propertyId, ...tenantWhere(scope) },
    select: { id: true, orgId: true, websiteUrl: true },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const today = todayUtcStart();

  const [
    targetQueries,
    serpRankingsToday,
    auditsToday,
    backlinksToday,
    competitorsTotal,
    recommendationsTotal,
  ] = await Promise.all([
    prisma.seoTargetQuery
      .count({
        where: { orgId: property.orgId, propertyId, active: true },
      })
      .catch(() => 0),
    prisma.serpRanking
      .count({
        where: { orgId: property.orgId, propertyId, date: today },
      })
      .catch(() => 0),
    prisma.onPageAudit
      .count({
        where: { orgId: property.orgId, propertyId, date: today },
      })
      .catch(() => 0),
    prisma.backlinkSummary
      .count({
        where: { orgId: property.orgId, propertyId, date: today },
      })
      .catch(() => 0),
    prisma.propertyCompetitorScan
      .count({ where: { propertyId } })
      .catch(() => 0),
    prisma.seoActionRecommendation
      .count({
        where: { orgId: property.orgId, propertyId, status: "OPEN" },
      })
      .catch(() => 0),
  ]);

  return NextResponse.json({
    ok: true,
    websiteUrl: property.websiteUrl,
    coverage: {
      targetQueries,
      serpRankingsToday,
      auditsToday,
      backlinksToday,
      competitorsTotal,
      recommendationsTotal,
    },
  });
}
