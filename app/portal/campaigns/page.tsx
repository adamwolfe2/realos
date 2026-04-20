import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ad campaigns"
        description="Campaigns running across every connected ad platform. Click a row for performance detail."
        actions={
          <Link
            href="/portal/creative"
            className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            Request creative
          </Link>
        }
      />

      {properties.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Properties haven&apos;t been set up yet, so no campaigns can run.
            Your account manager seeds those during build.
          </p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No ad campaigns yet. Once your ad accounts are connected and
            creative is approved, campaigns launch here.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] tracking-widest uppercase opacity-60">
              <tr>
                <th className="text-left px-4 py-2">Campaign</th>
                <th className="text-left px-4 py-2">Property</th>
                <th className="text-left px-4 py-2">Platform</th>
                <th className="text-right px-4 py-2">Budget</th>
                <th className="text-right px-4 py-2">Spend</th>
                <th className="text-right px-4 py-2">Clicks</th>
                <th className="text-right px-4 py-2">Conv.</th>
                <th className="text-center px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-sm">{c.name}</td>
                  <td className="px-4 py-2 text-xs opacity-80">
                    {c.property?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {c.platform}
                    {c.adAccount?.platform
                      ? ` (${c.adAccount.platform})`
                      : ""}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.monthlyBudgetCents
                      ? `$${Math.round(
                          c.monthlyBudgetCents / 100
                        ).toLocaleString()}/mo`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.spendToDateCents
                      ? `$${Math.round(
                          c.spendToDateCents / 100
                        ).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.clicks ?? 0}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.conversions ?? 0}
                  </td>
                  <td className="px-4 py-2 text-center text-[11px]">
                    {c.status ?? "unknown"}
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
