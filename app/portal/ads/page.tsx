import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import {
  parsePropertyFilter,
  propertyWhereFragment,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PageHeader } from "@/components/admin/page-header";
import { ExportButton } from "@/components/ui/export-button";
import { AdPlatform, LeadSource, LeadStatus } from "@prisma/client";
import { AdsDashboard } from "./ads-dashboard";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { MarketingRoiTable, type RoiRow } from "./marketing-roi-table";

export const metadata: Metadata = { title: "Ads" };
export const dynamic = "force-dynamic";

// /portal/ads — read-only paid ads dashboard.
//
// Shows a 28-day rolling view of spend, clicks, conversions, CPC, and
// cost-per-conversion across every connected ad platform. Operators can
// segment by Google Ads or Meta Ads, sort campaigns by any metric, and
// follow CTAs to connect a new ad account if none are wired yet.
export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ properties?: string; property?: string }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const propertyIds = parsePropertyFilter(sp);

  // Property filter on the Ads page narrows AdCampaign + AdMetricDaily
  // queries (both have propertyId). AdAccount is org-level (a single
  // Google Ads account often runs campaigns for multiple properties),
  // so we keep the accounts list unfiltered.
  const allProperties = await prisma.property.findMany({
    where: { orgId: scope.orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const properties = visibleProperties(scope, allProperties);
  const propertyFilter = propertyWhereFragment(scope, propertyIds);

  const now = new Date();
  // 28-day window. We compare to the prior 28-day window for delta arrows.
  const windowDays = 28;
  const dayMs = 24 * 60 * 60 * 1000;
  const currentStart = new Date(now.getTime() - windowDays * dayMs);
  const priorStart = new Date(now.getTime() - 2 * windowDays * dayMs);
  const priorEnd = currentStart;

  const since28d = currentStart;

  // HARD RULE: only show ad data that came from a real, credentialed
  // integration. Seeded fake accounts (Telegraph Commons / UC Berkeley /
  // 1234567890) live in the same tables but have credentialsEncrypted=NULL.
  // Filtering at the query layer means the UI can't accidentally show
  // fake data even if a row gets in via a script or migration.
  const realAccountWhere = {
    ...tenantWhere(scope),
    credentialsEncrypted: { not: null },
  };

  const [accounts, campaigns, currentMetrics, priorMetrics, leadsBySource, appsByLeadSource, signedBySource] = await Promise.all([
    prisma.adAccount.findMany({
      where: realAccountWhere,
      orderBy: [{ platform: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        platform: true,
        externalAccountId: true,
        displayName: true,
        currency: true,
        accessStatus: true,
        lastSyncAt: true,
        lastSyncError: true,
      },
    }),
    prisma.adCampaign.findMany({
      where: {
        ...tenantWhere(scope),
        ...propertyFilter,
        adAccount: { credentialsEncrypted: { not: null } },
      },
      orderBy: { spendToDateCents: "desc" },
      select: {
        id: true,
        adAccountId: true,
        platform: true,
        externalCampaignId: true,
        name: true,
        status: true,
        objective: true,
        impressions: true,
        clicks: true,
        conversions: true,
        spendToDateCents: true,
      },
    }),
    prisma.adMetricDaily.findMany({
      where: {
        ...tenantWhere(scope),
        date: { gte: currentStart },
        adAccount: { credentialsEncrypted: { not: null } },
        // Use propertyFilter (the gated, intersected fragment) so a
        // restricted user can't URL-hack into properties they don't
        // own. The campaign relation has its own propertyId column.
        ...("propertyId" in propertyFilter
          ? { campaign: propertyFilter }
          : {}),
      },
      orderBy: { date: "asc" },
      select: {
        adAccountId: true,
        date: true,
        impressions: true,
        clicks: true,
        spendCents: true,
        conversions: true,
      },
    }),
    prisma.adMetricDaily.findMany({
      where: {
        ...tenantWhere(scope),
        date: { gte: priorStart, lt: priorEnd },
        adAccount: { credentialsEncrypted: { not: null } },
        // Use propertyFilter (the gated, intersected fragment) so a
        // restricted user can't URL-hack into properties they don't
        // own. The campaign relation has its own propertyId column.
        ...("propertyId" in propertyFilter
          ? { campaign: propertyFilter }
          : {}),
      },
      select: {
        adAccountId: true,
        spendCents: true,
        clicks: true,
        conversions: true,
      },
    }),
    prisma.lead.groupBy({
      by: ["source"],
      where: {
        orgId: scope.orgId,
        ...propertyFilter,
        createdAt: { gte: since28d },
      },
      _count: { _all: true },
    }),
    prisma.application.findMany({
      where: {
        lead: {
          orgId: scope.orgId,
          ...propertyFilter,
          createdAt: { gte: since28d },
        },
      },
      select: { lead: { select: { source: true } } },
    }),
    prisma.lead.groupBy({
      by: ["source"],
      where: {
        orgId: scope.orgId,
        ...propertyFilter,
        status: LeadStatus.SIGNED,
        createdAt: { gte: since28d },
      },
      _count: { _all: true },
    }),
  ]);

  // Build spend-per-LeadSource from the 28-day daily metrics + account platform.
  const accountPlatformMap = new Map(accounts.map((a) => [a.id, a.platform]));
  const spendBySource: Partial<Record<LeadSource, number>> = {};
  for (const m of currentMetrics) {
    const platform = accountPlatformMap.get(m.adAccountId);
    if (platform === AdPlatform.GOOGLE_ADS) {
      spendBySource[LeadSource.GOOGLE_ADS] =
        (spendBySource[LeadSource.GOOGLE_ADS] ?? 0) + m.spendCents;
    } else if (platform === AdPlatform.META) {
      spendBySource[LeadSource.META_ADS] =
        (spendBySource[LeadSource.META_ADS] ?? 0) + m.spendCents;
    }
  }

  // Count applications per source.
  const appCountBySource: Partial<Record<LeadSource, number>> = {};
  for (const app of appsByLeadSource) {
    const src = app.lead.source;
    appCountBySource[src] = (appCountBySource[src] ?? 0) + 1;
  }

  const signedCountBySource = new Map(
    signedBySource.map((r) => [r.source, r._count._all]),
  );

  const channelLabel: Record<string, string> = {
    [LeadSource.GOOGLE_ADS]: "Google Ads",
    [LeadSource.META_ADS]: "Meta Ads",
    [LeadSource.ORGANIC]: "Organic search",
    [LeadSource.CHATBOT]: "Chatbot",
    [LeadSource.FORM]: "Website form",
    [LeadSource.REFERRAL]: "Referral",
    [LeadSource.PIXEL_OUTREACH]: "Pixel outreach",
    [LeadSource.DIRECT]: "Direct",
  };

  const roiRows: RoiRow[] = leadsBySource
    .filter((r) => r._count._all > 0)
    .map((r) => ({
      channel: channelLabel[r.source] ?? r.source,
      spendCents: spendBySource[r.source] ?? 0,
      leads: r._count._all,
      applications: appCountBySource[r.source] ?? 0,
      signed: signedCountBySource.get(r.source) ?? 0,
    }))
    .sort((a, b) => b.leads - a.leads);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paid ads"
        description="Spend, clicks, and conversions from every connected ad platform. Refreshes daily."
        actions={
          <div className="flex items-center gap-2">
            <PropertyMultiSelect
              properties={properties}
              orgId={scope.orgId}
            />
            <ExportButton href="/api/tenant/ad-metrics/export?days=90" />
            <Link
              href="/portal/settings/integrations"
              className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              Connect an ad account
            </Link>
          </div>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState />
      ) : (
        <AdsDashboard
          accounts={accounts.map((a) => ({
            id: a.id,
            platform: a.platform,
            displayName:
              a.displayName ?? defaultPlatformLabel(a.platform),
            externalAccountId: a.externalAccountId,
            currency: a.currency ?? "USD",
            lastSyncAt: a.lastSyncAt?.toISOString() ?? null,
            lastSyncError: a.lastSyncError ?? null,
            accessStatus: a.accessStatus ?? "active",
          }))}
          campaigns={campaigns.map((c) => ({
            id: c.id,
            adAccountId: c.adAccountId,
            platform: c.platform,
            externalCampaignId: c.externalCampaignId ?? "",
            name: c.name,
            status: c.status ?? "UNKNOWN",
            objective: c.objective ?? null,
            impressions: c.impressions ?? 0,
            clicks: c.clicks ?? 0,
            conversions: c.conversions ?? 0,
            spendCents: c.spendToDateCents ?? 0,
          }))}
          currentMetrics={currentMetrics.map((m) => ({
            adAccountId: m.adAccountId,
            date: m.date.toISOString(),
            impressions: m.impressions,
            clicks: m.clicks,
            spendCents: m.spendCents,
            conversions: m.conversions,
          }))}
          priorMetrics={priorMetrics.map((m) => ({
            adAccountId: m.adAccountId,
            spendCents: m.spendCents,
            clicks: m.clicks,
            conversions: m.conversions,
          }))}
        />
      )}

      <DashboardSection
        eyebrow="28-day attribution"
        title="Marketing ROI by channel"
        description="Spend, leads, applications, and signed leases per source. The funnel breakdown that tells you what's working."
      >
        <MarketingRoiTable rows={roiRows} />
      </DashboardSection>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-card p-10 text-center">
      <h2 className="text-base font-semibold text-foreground">
        No ad accounts connected yet
      </h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Connect Google Ads or Meta Ads to start pulling daily spend, clicks,
        and conversions into your dashboard. We do this read-only for now,
        no campaign edits.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/portal/settings/integrations"
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          Connect Google Ads
        </Link>
        <Link
          href="/portal/settings/integrations"
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          Connect Meta Ads
        </Link>
      </div>
    </div>
  );
}

function defaultPlatformLabel(p: AdPlatform): string {
  switch (p) {
    case AdPlatform.GOOGLE_ADS:
      return "Google Ads";
    case AdPlatform.META:
      return "Meta Ads";
    case AdPlatform.LINKEDIN:
      return "LinkedIn Ads";
    case AdPlatform.TIKTOK:
      return "TikTok Ads";
    case AdPlatform.REDDIT:
      return "Reddit Ads";
  }
}
