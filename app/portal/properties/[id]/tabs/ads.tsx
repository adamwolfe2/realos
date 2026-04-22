import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import {
  getPropertyAds,
  centsToUsdShort,
} from "@/lib/properties/queries";

export async function AdsTab({
  orgId,
  propertyId,
}: {
  orgId: string;
  propertyId: string;
}) {
  const data = await getPropertyAds(orgId, propertyId);

  if (data.campaigns.length === 0) {
    return (
      <div className="space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile label="Spend (28d)" value="—" />
          <KpiTile label="Leads (28d)" value="—" />
          <KpiTile label="Campaigns" value={0} />
          <KpiTile label="CPL" value="—" />
        </section>
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm font-semibold text-foreground">
            No campaigns linked to this property
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Attach a campaign to this property from the Campaigns module to see
            spend, CPL, and attribution here.
          </p>
        </div>
      </div>
    );
  }

  const cpl =
    data.totalLeads28d > 0
      ? centsToUsdShort(Math.round(data.totalSpendCents28d / data.totalLeads28d))
      : "—";

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Spend (28d)"
          value={centsToUsdShort(data.totalSpendCents28d)}
          spark={data.spendSparkline}
        />
        <KpiTile
          label="Leads (28d)"
          value={data.totalLeads28d}
          hint="Attributed via campaign name match"
        />
        <KpiTile
          label="Campaigns"
          value={data.campaigns.length}
          hint="Linked to property"
        />
        <KpiTile label="CPL" value={cpl} />
      </section>

      <DashboardSection
        title="Campaigns"
        eyebrow="Per campaign, last 28 days"
      >
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead className="text-[10px] tracking-widest uppercase text-muted-foreground">
              <tr>
                <th className="text-left font-semibold pb-2">Campaign</th>
                <th className="text-left font-semibold pb-2">Platform</th>
                <th className="text-left font-semibold pb-2">Status</th>
                <th className="text-right font-semibold pb-2">Spend</th>
                <th className="text-right font-semibold pb-2">Leads</th>
                <th className="text-right font-semibold pb-2">CPL</th>
                <th className="text-right font-semibold pb-2">Conv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="py-2.5 text-xs text-foreground max-w-[260px] truncate">
                    {c.name}
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground">
                    {c.platform}
                  </td>
                  <td className="py-2.5">
                    <StatusChip status={c.status} />
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-xs">
                    {centsToUsdShort(c.spendCents28d)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-xs">
                    {c.leads28d}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {c.cplCents == null ? "—" : centsToUsdShort(c.cplCents)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {c.conversionPct == null ? "—" : `${c.conversionPct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>
    </div>
  );
}

function StatusChip({ status }: { status: string | null }) {
  const s = (status ?? "").toUpperCase();
  const isActive = s === "ENABLED" || s === "ACTIVE";
  return (
    <span
      className={
        isActive
          ? "inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-700"
          : "inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-muted text-muted-foreground"
      }
    >
      {s || "UNKNOWN"}
    </span>
  );
}
