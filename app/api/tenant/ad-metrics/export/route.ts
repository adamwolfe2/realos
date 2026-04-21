import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireScope,
  tenantWhere,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { AuditAction, AdPlatform } from "@prisma/client";
import { buildCsv, csvFileResponse } from "@/lib/csv";

// GET /api/tenant/ad-metrics/export
//
// Streams per-day AdMetricDaily rows for the last N days (default 90) as CSV.
// Useful for plugging into Looker / Sheets / Excel for ad-hoc analysis.
export async function GET(req: Request) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get("days") ?? "90", 10)));
  const platform = url.searchParams.get("platform");

  const where: Record<string, unknown> = {
    ...tenantWhere(scope),
    date: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
  };

  const metrics = await prisma.adMetricDaily.findMany({
    where,
    orderBy: [{ date: "desc" }, { campaignId: "asc" }],
    take: 100_000,
    include: {
      campaign: { select: { name: true, platform: true } },
      adAccount: { select: { displayName: true, externalAccountId: true } },
    },
  });

  const filtered =
    platform && platform in AdPlatform
      ? metrics.filter((m) => m.campaign.platform === (platform as AdPlatform))
      : metrics;

  const header = [
    "date",
    "platform",
    "ad_account",
    "campaign",
    "impressions",
    "clicks",
    "spend_usd",
    "conversions",
    "ctr",
    "cpc_usd",
    "cost_per_conversion_usd",
  ];
  const rows = filtered.map((m) => [
    m.date.toISOString().slice(0, 10),
    m.campaign.platform,
    m.adAccount.displayName ?? m.adAccount.externalAccountId,
    m.campaign.name,
    m.impressions,
    m.clicks,
    (m.spendCents / 100).toFixed(2),
    m.conversions.toFixed(2),
    m.ctr.toFixed(4),
    (m.cpcCents / 100).toFixed(2),
    (m.costPerConversionCents / 100).toFixed(2),
  ]);

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.EXPORT,
      entityType: "AdMetricDaily",
      description: `Exported ${filtered.length} ad metric rows (${days}d) to CSV`,
      diff: { count: filtered.length, days, platform },
    }),
  });

  const filename = `ad-metrics-${scope.orgId}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvFileResponse(buildCsv(header, rows), filename);
}
