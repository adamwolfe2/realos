import { NextResponse } from "next/server";
import {
  requireScope,
  tenantWhere,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { AuditAction, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildCsv, csvFileResponse } from "@/lib/csv";
import { adsExportLimiter, checkRateLimit, rateLimited } from "@/lib/rate-limit";
import { realAdAccountWhere } from "@/lib/integrations/real-ad-account";

// GET /api/portal/ads/export
//
// Streams the org's full historical ad metrics as CSV — both AdMetricDaily
// (recent, day-level granularity) and AdMetricMonthly (older, rolled up by
// the retention cron). Each row carries a `granularity` column so the
// consumer can tell apart the resolution.
//
// Auth: requireScope() + role gate. CLIENT_OWNER / CLIENT_ADMIN see their
// own org; AGENCY_OWNER / AGENCY_ADMIN see whichever org they're scoped to
// (impersonation already collapses orgId for them).
//
// Rate limit: 1/hour/org. The full history is up to ~5 years of dailies +
// monthlies and we don't want a tab-spam loop to burn the connection pool.
const EXPORT_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
]);

export async function GET() {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  if (!EXPORT_ROLES.has(scope.role)) {
    return NextResponse.json(
      { error: "Export requires owner or admin role" },
      { status: 403 },
    );
  }

  const limit = await checkRateLimit(adsExportLimiter, `ads-export:${scope.orgId}`);
  if (!limit.allowed) {
    return rateLimited(
      "Ads history export is limited to once per hour per workspace.",
      Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000)),
    );
  }

  // Pull both shapes in parallel. We intentionally do NOT bound the
  // window — the operator asked for "full historical," and the retention
  // job already caps how much daily data exists per tier.
  const realAccountFilter = await realAdAccountWhere(scope.orgId);
  const [daily, monthly, accounts] = await Promise.all([
    prisma.adMetricDaily.findMany({
      where: {
        ...tenantWhere(scope),
        adAccount: realAccountFilter,
      },
      orderBy: [{ date: "asc" }, { adAccountId: "asc" }],
      select: {
        date: true,
        adAccountId: true,
        impressions: true,
        clicks: true,
        spendCents: true,
        conversions: true,
        conversionValueCents: true,
      },
    }),
    prisma.adMetricMonthly.findMany({
      where: { orgId: scope.orgId },
      orderBy: [{ year: "asc" }, { month: "asc" }, { adAccountId: "asc" }],
      select: {
        year: true,
        month: true,
        adAccountId: true,
        impressions: true,
        clicks: true,
        spendCents: true,
        conversions: true,
        conversionValueCents: true,
        daysAggregated: true,
      },
    }),
    prisma.adAccount.findMany({
      where: tenantWhere(scope),
      select: {
        id: true,
        platform: true,
        externalAccountId: true,
        displayName: true,
      },
    }),
  ]);

  const accountInfo = new Map(
    accounts.map((a) => [
      a.id,
      {
        platform: a.platform,
        label: a.displayName ?? a.externalAccountId,
      },
    ]),
  );

  const header = [
    "date",
    "granularity",
    "platform",
    "ad_account",
    "ad_account_id",
    "impressions",
    "clicks",
    "spend_usd",
    "conversions",
    "conversion_value_usd",
    "days_aggregated",
  ];

  const rows: unknown[][] = [];

  for (const m of daily) {
    const acct = accountInfo.get(m.adAccountId);
    rows.push([
      m.date.toISOString().slice(0, 10),
      "daily",
      acct?.platform ?? "",
      acct?.label ?? "",
      m.adAccountId,
      m.impressions,
      m.clicks,
      (m.spendCents / 100).toFixed(2),
      m.conversions.toFixed(2),
      (m.conversionValueCents / 100).toFixed(2),
      1,
    ]);
  }

  for (const m of monthly) {
    // Anchor monthly buckets on YYYY-MM-01 so a sort-by-date in a spreadsheet
    // still interleaves them cleanly with the daily rows.
    const date = `${m.year.toString().padStart(4, "0")}-${m.month
      .toString()
      .padStart(2, "0")}-01`;
    const acct = accountInfo.get(m.adAccountId);
    rows.push([
      date,
      "monthly",
      acct?.platform ?? "",
      acct?.label ?? "",
      m.adAccountId,
      m.impressions,
      m.clicks,
      (m.spendCents / 100).toFixed(2),
      m.conversions.toFixed(2),
      (m.conversionValueCents / 100).toFixed(2),
      m.daysAggregated,
    ]);
  }

  // Final sort: date asc, granularity asc (so daily rows come first
  // within a tied date — though the half-open retention boundary makes
  // ties improbable in practice).
  rows.sort((a, b) => {
    const ad = String(a[0]);
    const bd = String(b[0]);
    if (ad !== bd) return ad.localeCompare(bd);
    return String(a[1]).localeCompare(String(b[1]));
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.EXPORT,
      entityType: "AdMetricHistory",
      description: `Exported ${rows.length} ad history rows (${daily.length} daily, ${monthly.length} monthly) to CSV`,
      diff: { daily: daily.length, monthly: monthly.length },
    }),
  });

  const filename = `ad-history-${scope.orgId}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvFileResponse(buildCsv(header, rows), filename);
}
