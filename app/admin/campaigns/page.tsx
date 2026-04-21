import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { AdPlatform } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Ad campaigns" };
export const dynamic = "force-dynamic";

const PLATFORM_LABEL: Record<AdPlatform, string> = {
  GOOGLE_ADS: "Google Ads",
  META: "Meta",
  LINKEDIN: "LinkedIn",
  TIKTOK: "TikTok",
  REDDIT: "Reddit",
};

const PLATFORM_TONE: Record<AdPlatform, string> = {
  GOOGLE_ADS: "bg-amber-100 text-amber-700",
  META: "bg-sky-100 text-sky-700",
  LINKEDIN: "bg-blue-100 text-blue-700",
  TIKTOK: "bg-rose-100 text-rose-700",
  REDDIT: "bg-orange-100 text-orange-700",
};

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  await requireAgency();
  const { platform } = await searchParams;

  const where: { platform?: AdPlatform } = {};
  if (platform && platform in AdPlatform) {
    where.platform = platform as AdPlatform;
  }

  const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

  const campaigns = await prisma.adCampaign.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      org: { select: { name: true, slug: true, id: true } },
      property: { select: { name: true } },
      adAccount: { select: { displayName: true, externalAccountId: true } },
    },
    take: 500,
  });

  // Aggregate 28d metrics per campaign in one query
  const metrics = await prisma.adMetricDaily.groupBy({
    by: ["campaignId"],
    where: {
      date: { gte: since },
      campaignId: { in: campaigns.map((c) => c.id) },
    },
    _sum: {
      spendCents: true,
      clicks: true,
      impressions: true,
      conversions: true,
    },
  });
  const metricsByCampaign = new Map(
    metrics.map((m) => [m.campaignId, m._sum]),
  );

  const totalSpend = metrics.reduce(
    (acc, m) => acc + (m._sum.spendCents ?? 0),
    0,
  );
  const totalClicks = metrics.reduce(
    (acc, m) => acc + (m._sum.clicks ?? 0),
    0,
  );
  const totalConversions = metrics.reduce(
    (acc, m) => acc + (m._sum.conversions ?? 0),
    0,
  );
  const activeCount = campaigns.filter((c) =>
    ["ENABLED", "ACTIVE"].includes(c.status ?? ""),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ad campaigns"
        description="Cross-tenant view of every paid campaign on Google Ads and Meta. Read-only until OAuth lands."
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Stat label="Active campaigns" value={activeCount.toString()} />
        <Stat label="Spend (28d)" value={formatCents(totalSpend)} />
        <Stat
          label="Clicks (28d)"
          value={totalClicks.toLocaleString("en-US")}
        />
        <Stat
          label="Conversions (28d)"
          value={totalConversions.toFixed(0)}
        />
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Filter:</span>
        <FilterChip href="/admin/campaigns" active={!platform}>
          All
        </FilterChip>
        {Object.values(AdPlatform).map((p) => (
          <FilterChip
            key={p}
            href={`/admin/campaigns?platform=${p}`}
            active={platform === p}
          >
            {PLATFORM_LABEL[p]}
          </FilterChip>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Campaign</th>
              <th className="px-4 py-3 text-left font-medium">Tenant</th>
              <th className="px-4 py-3 text-left font-medium">Platform</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Spend (28d)</th>
              <th className="px-4 py-3 text-right font-medium">Clicks</th>
              <th className="px-4 py-3 text-right font-medium">Conv.</th>
              <th className="px-4 py-3 text-right font-medium">CPC</th>
              <th className="px-4 py-3 text-right font-medium">CPL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  No campaigns yet. Tenants connect their ad accounts under
                  Settings → Integrations.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => {
                const m = metricsByCampaign.get(c.id);
                const spend = m?.spendCents ?? 0;
                const clicks = m?.clicks ?? 0;
                const conversions = m?.conversions ?? 0;
                const cpc = clicks > 0 ? spend / clicks : null;
                const cpl = conversions > 0 ? spend / conversions : null;
                return (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.adAccount.displayName ?? c.adAccount.externalAccountId}
                        {c.property?.name && ` • ${c.property.name}`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/clients/${c.org.id}`}
                        className="hover:underline"
                      >
                        {c.org.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {c.org.slug}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${PLATFORM_TONE[c.platform]}`}
                      >
                        {PLATFORM_LABEL[c.platform]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.status ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCents(spend)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {clicks.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {conversions.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {cpc != null ? formatCents(cpc) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {cpl != null ? formatCents(cpl) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Aggregated from{" "}
        <code className="font-mono">AdMetricDaily</code> over the last 28 days.
        Daily sync runs at 07:00 UTC.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card hover:bg-muted/30"
      }`}
    >
      {children}
    </Link>
  );
}
