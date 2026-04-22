import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";

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

function statusBadge(status: string | null) {
  const s = (status ?? "").toUpperCase();
  if (s === "ENABLED" || s === "ACTIVE")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "PAUSED")
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "REMOVED" || s === "DELETED")
    return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-muted text-muted-foreground border-border";
}

function statusLabel(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "enabled") return "Active";
  if (s === "paused") return "Paused";
  if (s === "removed" || s === "deleted") return "Removed";
  return status ?? "Unknown";
}

export default async function CampaignsPage() {
  const scope = await requireScope();
  const [campaigns, properties] = await Promise.all([
    prisma.adCampaign.findMany({
      where: tenantWhere(scope),
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
      include: {
        property: { select: { id: true, name: true } },
        adAccount: { select: { platform: true } },
      },
    }),
    prisma.property.findMany({
      where: tenantWhere(scope),
      select: { id: true, name: true },
    }),
  ]);

  const totalSpend = campaigns.reduce(
    (sum, c) => sum + (c.spendToDateCents ?? 0),
    0
  );
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks ?? 0), 0);
  const totalConv = campaigns.reduce((sum, c) => sum + (c.conversions ?? 0), 0);
  const activeCampaigns = campaigns.filter(
    (c) => (c.status ?? "").toUpperCase() === "ENABLED"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ad campaigns"
        description="Campaigns running across every connected ad platform."
        actions={
          <Link
            href="/portal/creative"
            className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            Request creative
          </Link>
        }
      />

      {/* Summary tiles */}
      {campaigns.length > 0 && (
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
            <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                {s.label}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {properties.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Add a property first, then your account manager will set up campaigns here.
          </p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground mb-1">No campaigns yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Once your Google Ads or Meta ad accounts are connected and creative is approved, campaigns will appear here with live performance data.
          </p>
          <Link
            href="/portal/settings"
            className="mt-4 inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Connect ad accounts
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
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
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {c.property?.name ?? "—"}
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
                    {c.spendToDateCents
                      ? `$${Math.round(c.spendToDateCents / 100).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
                    {(c.clicks ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
                    {(c.conversions ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadge(c.status)}`}
                    >
                      {statusLabel(c.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
