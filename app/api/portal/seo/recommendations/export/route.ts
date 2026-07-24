import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/portal/seo/recommendations/export
//
// Streams a CSV of every OPEN + IN_PROGRESS SEO recommendation in the
// org so operators can share with their internal team (or paste into a
// spreadsheet). Tenant-scoped via requireScope. No pagination — the
// engine caps at ~10 recs/property × portfolio size, well under 1000
// rows for any realistic portfolio.
//
// Columns: property | category | severity | title | detail | est_minutes |
//          score | status | action_url | refreshed_at
// ---------------------------------------------------------------------------

const HEADERS = [
  "property",
  "category",
  "severity",
  "title",
  "detail",
  "est_minutes",
  "score",
  "status",
  "action_url",
  "refreshed_at",
];

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  // RFC 4180: quote if contains comma, quote, or newline. Escape quotes
  // by doubling them.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const where: Record<string, unknown> = {
    ...tenantWhere(scope),
    status: { in: ["OPEN", "IN_PROGRESS"] },
  };
  if (scope.allowedPropertyIds) {
    where.propertyId = { in: scope.allowedPropertyIds };
  }

  const recs = await prisma.seoActionRecommendation.findMany({
    where: where as never,
    orderBy: [{ severity: "asc" }, { score: "desc" }],
    take: 1000,
    select: {
      category: true,
      severity: true,
      title: true,
      detail: true,
      estimateMinutes: true,
      score: true,
      status: true,
      actionHref: true,
      refreshedAt: true,
      property: { select: { name: true } },
    },
  });

  const rows = recs.map((r) =>
    [
      r.property?.name ?? "",
      r.category,
      r.severity,
      r.title,
      r.detail,
      r.estimateMinutes,
      Math.round(r.score),
      r.status,
      r.actionHref ?? "",
      r.refreshedAt.toISOString(),
    ]
      .map(csvEscape)
      .join(","),
  );

  const csv = [HEADERS.join(","), ...rows].join("\n");
  const filename = `seo-recommendations-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
