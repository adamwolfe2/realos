import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { ConversionFunnel } from "@/components/portal/dashboard/conversion-funnel";
import { LeadSourceDonut } from "@/components/portal/dashboard/lead-source-donut";
import { getPropertyLeads } from "@/lib/properties/queries";

export async function LeadsTab({
  orgId,
  propertyId,
  propertyMeta,
}: {
  orgId: string;
  propertyId: string;
  propertyMeta: { slug: string; name: string };
}) {
  const data = await getPropertyLeads(orgId, propertyId, propertyMeta);

  const leadsCount = data.funnel.find((s) => s.label === "Leads")?.value ?? 0;
  const toursCount = data.funnel.find((s) => s.label === "Tours")?.value ?? 0;
  const appsCount = data.funnel.find((s) => s.label === "Applications")?.value ?? 0;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Leads (28d)" value={leadsCount} />
        <KpiTile label="Tours (28d)" value={toursCount} />
        <KpiTile label="Applications (28d)" value={appsCount} />
        <KpiTile
          label="Conversion"
          value={data.conversionPct == null ? "—" : `${data.conversionPct}%`}
          hint="All-time signed / total leads"
        />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DashboardSection
          title="Conversion funnel"
          eyebrow="Last 28 days"
          description="Visitors scoped by URL match on property slug"
        >
          {data.funnel.every((s) => s.value === 0) ? (
            <p className="text-xs text-[var(--stone-gray)]">
              No activity in the last 28 days yet.
            </p>
          ) : (
            <ConversionFunnel stages={data.funnel} />
          )}
        </DashboardSection>

        <DashboardSection
          title="Lead sources"
          eyebrow="Last 28 days"
          description="Where this property's leads originate"
        >
          <LeadSourceDonut slices={data.sourceBreakdown} />
        </DashboardSection>
      </div>

      <DashboardSection
        title="Recent leads"
        eyebrow="Latest 10"
        href="/portal/leads"
        hrefLabel="All leads"
      >
        {data.recent.length === 0 ? (
          <p className="text-xs text-[var(--stone-gray)]">
            No leads have been recorded for this property yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-cream)]">
            {data.recent.map((lead) => {
              const name =
                [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() ||
                lead.email ||
                "Anonymous";
              return (
                <li key={lead.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={`/portal/leads/${lead.id}`}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--near-black)] truncate">
                        {name}
                      </div>
                      <div className="text-[11px] text-[var(--stone-gray)] mt-0.5">
                        {lead.source}
                        {lead.email ? ` \u00b7 ${lead.email}` : ""}
                      </div>
                    </div>
                    <div className="text-[11px] text-[var(--stone-gray)] whitespace-nowrap">
                      {formatDistanceToNow(lead.createdAt, { addSuffix: true })}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardSection>
    </div>
  );
}
