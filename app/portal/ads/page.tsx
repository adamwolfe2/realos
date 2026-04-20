import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { AdPlatform } from "@prisma/client";
import { AdsDashboard } from "./ads-dashboard";

export const metadata: Metadata = { title: "Ads" };
export const dynamic = "force-dynamic";

// /portal/ads — read-only paid ads dashboard.
//
// Shows a 28-day rolling view of spend, clicks, conversions, CPC, and
// cost-per-conversion across every connected ad platform. Operators can
// segment by Google Ads or Meta Ads, sort campaigns by any metric, and
// follow CTAs to connect a new ad account if none are wired yet.
export default async function AdsPage() {
  const scope = await requireScope();

  const now = new Date();
  // 28-day window. We compare to the prior 28-day window for delta arrows.
  const windowDays = 28;
  const dayMs = 24 * 60 * 60 * 1000;
  const currentStart = new Date(now.getTime() - windowDays * dayMs);
  const priorStart = new Date(now.getTime() - 2 * windowDays * dayMs);
  const priorEnd = currentStart;

  const [accounts, campaigns, currentMetrics, priorMetrics] = await Promise.all([
    prisma.adAccount.findMany({
      where: tenantWhere(scope),
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
      where: tenantWhere(scope),
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
      },
      select: {
        adAccountId: true,
        spendCents: true,
        clicks: true,
        conversions: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paid ads"
        description="Spend, clicks, and conversions from every connected ad platform. Refreshes daily."
        actions={
          <Link
            href="/portal/settings/integrations"
            className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            Connect an ad account
          </Link>
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
