import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  parsePropertyFilter,
  propertyWhereFragment,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { DataPlaceholder } from "@/components/portal/ui/data-placeholder";
import { Megaphone, Clock } from "lucide-react";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

function platformLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  const s = raw.toUpperCase();
  if (s.includes("GOOGLE")) return "Google Ads";
  if (s.includes("META") || s.includes("FACEBOOK")) return "Meta Ads";
  if (s.includes("TIKTOK")) return "TikTok Ads";
  if (s.includes("LINKEDIN")) return "LinkedIn Ads";
  return raw;
}

// Build a "manage in native platform" URL when we know the platform +
// external id. Lets the row be a one-click escape hatch into Google Ads
// or Meta Ads Manager since LeaseStack doesn't yet ship its own campaign
// detail page. Returns null when we can't build a useful URL — caller
// renders the row as non-interactive in that case.
function platformManageUrl(args: {
  platform: string | null | undefined;
  externalCampaignId: string | null | undefined;
  externalAccountId: string | null | undefined;
}): string | null {
  const platform = (args.platform ?? "").toUpperCase();
  const cid = args.externalCampaignId;
  if (!cid) return null;
  if (platform.includes("GOOGLE")) {
    // Google Ads campaign edit page — opens in the right account when the
    // operator is already signed in.
    return `https://ads.google.com/aw/campaigns?campaignId=${encodeURIComponent(cid)}`;
  }
  if (platform.includes("META") || platform.includes("FACEBOOK")) {
    const acct = args.externalAccountId
      ? `&act=${encodeURIComponent(args.externalAccountId)}`
      : "";
    return `https://business.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${encodeURIComponent(cid)}${acct}`;
  }
  return null;
}

function statusBadge(status: string | null) {
  const s = (status ?? "").toUpperCase();
  if (s === "ENABLED" || s === "ACTIVE")
    return "bg-primary/10 text-primary border-primary/30";
  if (s === "PAUSED")
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "REMOVED" || s === "DELETED")
    return "bg-muted text-muted-foreground border-border";
  return "bg-muted text-muted-foreground border-border";
}

function statusLabel(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "enabled") return "Active";
  if (s === "paused") return "Paused";
  if (s === "removed" || s === "deleted") return "Removed";
  return status ?? "Unknown";
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ properties?: string; property?: string }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const propertyIds = parsePropertyFilter(sp);
  const propertyFilter = propertyWhereFragment(scope, propertyIds);

  // 28-day rolling window — matches the Ads dashboard so the two pages
  // never disagree on spend totals (audit BUG-05).
  const since28d = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

  const [campaigns, properties, metricsByCampaign] = await Promise.all([
    prisma.adCampaign.findMany({
      where: { ...tenantWhere(scope), ...propertyFilter },
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
      include: {
        property: { select: { id: true, name: true } },
        adAccount: {
          select: { platform: true, externalAccountId: true },
        },
      },
    }),
    prisma.property.findMany({
      where: marketablePropertyWhere(scope.orgId),
      select: { id: true, name: true },
    }),
    prisma.adMetricDaily.groupBy({
      by: ["campaignId"],
      where: {
        ...tenantWhere(scope),
        date: { gte: since28d },
        // Restricted users would otherwise URL-hack their way to
        // campaigns they can't see — propertyFilter is the gated form.
        ...("propertyId" in propertyFilter
          ? { campaign: propertyFilter }
          : {}),
      },
      _sum: {
        spendCents: true,
        clicks: true,
        conversions: true,
      },
    }),
  ]);

  // Roll daily metrics up onto each campaign so the table + summary tiles
  // always match the Ads page. Falls back to the denormalized
  // spendToDateCents counter when no daily metrics exist.
  const metricsMap = new Map<
    string,
    { spendCents: number; clicks: number; conversions: number }
  >();
  for (const m of metricsByCampaign) {
    metricsMap.set(m.campaignId, {
      spendCents: m._sum.spendCents ?? 0,
      clicks: m._sum.clicks ?? 0,
      conversions: m._sum.conversions ?? 0,
    });
  }

  function spendFor(c: { id: string; spendToDateCents: number | null }) {
    return metricsMap.get(c.id)?.spendCents ?? c.spendToDateCents ?? 0;
  }
  function clicksFor(c: { id: string; clicks: number | null }) {
    return metricsMap.get(c.id)?.clicks ?? c.clicks ?? 0;
  }
  function convFor(c: { id: string; conversions: number | null }) {
    return metricsMap.get(c.id)?.conversions ?? c.conversions ?? 0;
  }

  const totalSpend = campaigns.reduce((sum, c) => sum + spendFor(c), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + clicksFor(c), 0);
  const totalConv = campaigns.reduce((sum, c) => sum + convFor(c), 0);
  const activeCampaigns = campaigns.filter(
    (c) => (c.status ?? "").toUpperCase() === "ENABLED"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ad campaigns"
        description="Campaigns running across every connected ad platform."
        actions={
          <div className="flex items-center gap-2">
            <PropertyMultiSelect
              properties={visibleProperties(scope, properties)}
              orgId={scope.orgId}
            />
            <Link
              href="/portal/creative"
              className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              Request creative
            </Link>
          </div>
        }
      />

      {/* Summary tiles */}
      {campaigns.length > 0 && totalSpend === 0 && totalClicks === 0 && totalConv === 0 ? (
        <DataPlaceholder
          intent="waiting"
          icon={<Clock className="h-4 w-4" />}
          title="Campaigns connected — waiting on first metrics sync"
          body="Spend, clicks, and conversions for the last 28 days will appear here within 24 hours of the first nightly sync."
        />
      ) : campaigns.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Active campaigns", value: activeCampaigns },
            {
              label: "Total spend",
              value: totalSpend ? `$${Math.round(totalSpend / 100).toLocaleString()}` : "—",
            },
            { label: "Total clicks", value: totalClicks.toLocaleString() },
            { label: "Conversions", value: totalConv.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 hover:shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                {s.label}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {s.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {properties.length === 0 ? (
        <EmptyState
          title="Add a property first"
          body="Add a property, then your account manager will set up campaigns here."
        />
      ) : campaigns.length === 0 ? (
        <DataPlaceholder
          intent="connect"
          icon={<Megaphone className="h-4 w-4" />}
          title="No campaigns yet"
          body="Once your Google Ads or Meta ad accounts are connected and creative is approved, campaigns will appear here with live performance data."
          action={{ label: "Connect ad accounts", href: "/portal/connect" }}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                  Campaign
                </th>
                <th className="text-left px-4 py-3 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                  Property
                </th>
                <th className="text-left px-4 py-3 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                  Platform
                </th>
                <th className="text-right px-4 py-3 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                  Budget
                </th>
                <th className="text-right px-4 py-3 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                  Spend
                </th>
                <th className="text-right px-4 py-3 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                  Clicks
                </th>
                <th className="text-right px-4 py-3 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                  Conv.
                </th>
                <th className="text-center px-4 py-3 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((c) => {
                const manageUrl = platformManageUrl({
                  platform: c.adAccount?.platform ?? c.platform,
                  externalCampaignId: c.externalCampaignId,
                  externalAccountId: c.adAccount?.externalAccountId ?? null,
                });
                return (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground max-w-[14rem]">
                    {manageUrl ? (
                      <a
                        href={manageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate hover:text-primary hover:underline underline-offset-2"
                        title={`Open in ${platformLabel(c.adAccount?.platform ?? c.platform)} ↗`}
                      >
                        {c.name}
                      </a>
                    ) : (
                      <span
                        className="block truncate"
                        title="Sync data so we can link out to this campaign in the native ad platform"
                      >
                        {c.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-[10rem]">
                    <span className="block truncate">{c.property?.name ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {platformLabel(c.adAccount?.platform ?? c.platform)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
                    {c.monthlyBudgetCents
                      ? `$${Math.round(c.monthlyBudgetCents / 100).toLocaleString()}/mo`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
                    {spendFor(c) > 0
                      ? `$${Math.round(spendFor(c) / 100).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
                    {clicksFor(c).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
                    {Math.round(convFor(c)).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadge(c.status)}`}
                    >
                      {statusLabel(c.status)}
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
