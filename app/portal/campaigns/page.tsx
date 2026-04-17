import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";

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
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold">Ad campaigns</h1>
          <p className="text-sm opacity-60 mt-1">
            Campaigns we're running across Google, Meta, and other ad
            platforms. Click a row for performance detail (read-only in v1).
          </p>
        </div>
        <Link
          href="/portal/creative"
          className="text-xs px-3 py-2 border rounded"
        >
          Request new creative
        </Link>
      </header>

      {properties.length === 0 ? (
        <p className="text-sm opacity-60 border rounded-md p-6">
          Properties haven't been seeded yet, so no campaigns can run. Your
          account manager seeds those during build.
        </p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm opacity-60 border rounded-md p-6">
          No ad campaigns yet. Once Google/Meta are connected and creative is
          approved, campaigns launch here.
        </p>
      ) : (
        <div className="border rounded-md overflow-x-auto">
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
