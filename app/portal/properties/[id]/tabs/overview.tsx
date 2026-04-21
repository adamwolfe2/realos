import { prisma } from "@/lib/db";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import {
  getPropertyOverviewKpis,
  centsToUsdShort,
  pctChange,
} from "@/lib/properties/queries";
import type {
  BackendPlatform,
  CommercialSubtype,
  PropertyType,
  ResidentialSubtype,
} from "@prisma/client";

type OverviewProperty = {
  propertyType: PropertyType;
  residentialSubtype: ResidentialSubtype | null;
  commercialSubtype: CommercialSubtype | null;
  totalUnits: number | null;
  yearBuilt: number | null;
  backendPlatform: BackendPlatform;
  backendPropertyGroup: string | null;
  lastSyncedAt: Date | null;
  metaTitle: string | null;
  metaDescription: string | null;
  virtualTourUrl: string | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  description: string | null;
};

export async function OverviewTab({
  orgId,
  propertyId,
  propertyMeta,
  property,
}: {
  orgId: string;
  propertyId: string;
  propertyMeta: { slug: string; name: string };
  property: OverviewProperty;
}) {
  const [kpis, listingCounts] = await Promise.all([
    getPropertyOverviewKpis(orgId, propertyId, propertyMeta),
    prisma.property.findFirst({
      where: { id: propertyId, orgId },
      select: {
        _count: { select: { listings: true, leads: true } },
        listings: {
          where: { isAvailable: true },
          select: { id: true },
        },
      },
    }),
  ]);

  const leadsDeltaPct = pctChange(kpis.leads28d, kpis.leadsPrev28d);
  const leadsDelta = leadsDeltaPct == null
    ? undefined
    : {
        value: `${leadsDeltaPct > 0 ? "+" : ""}${leadsDeltaPct}%`,
        trend: leadsDeltaPct > 0 ? ("up" as const) : leadsDeltaPct < 0 ? ("down" as const) : ("flat" as const),
      };

  const priceRange =
    property.priceMinCents || property.priceMaxCents
      ? `${centsToUsdShort(property.priceMinCents)}${"\u2013"}${centsToUsdShort(property.priceMaxCents)}`
      : "—";

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiTile
          label="Leads (28d)"
          value={kpis.leads28d}
          delta={leadsDelta}
          spark={kpis.leadsSparkline}
        />
        <KpiTile
          label="Tours (28d)"
          value={kpis.tours28d}
          hint="Scheduled or completed"
        />
        <KpiTile
          label="Applications (28d)"
          value={kpis.applications28d}
        />
        <KpiTile
          label="Ad spend (28d)"
          value={centsToUsdShort(kpis.adSpendCents28d)}
          hint="Attributed to this property"
        />
        <KpiTile
          label="Organic (28d)"
          value={
            kpis.organicMapped
              ? kpis.organicSessions28d == null
                ? "—"
                : kpis.organicSessions28d.toLocaleString()
              : "—"
          }
          hint={
            kpis.organicMapped
              ? "Sessions on matching URLs"
              : "No property URL mapping"
          }
        />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiTile
          label="Listings"
          value={listingCounts?._count.listings ?? 0}
        />
        <KpiTile
          label="Available"
          value={listingCounts?.listings.length ?? 0}
        />
        <KpiTile
          label="All-time leads"
          value={listingCounts?._count.leads ?? 0}
        />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DashboardSection
          title="Property details"
          eyebrow="Basics"
        >
          <dl className="space-y-1.5 text-sm">
            <Row k="Type" v={property.propertyType} />
            <Row
              k="Subtype"
              v={
                property.residentialSubtype ??
                property.commercialSubtype ??
                "—"
              }
            />
            <Row k="Total units" v={property.totalUnits?.toString() ?? "—"} />
            <Row k="Year built" v={property.yearBuilt?.toString() ?? "—"} />
            <Row k="Backend" v={property.backendPlatform} />
            <Row
              k="Property group"
              v={property.backendPropertyGroup ?? "—"}
            />
            <Row
              k="Last synced"
              v={
                property.lastSyncedAt
                  ? new Date(property.lastSyncedAt).toLocaleString()
                  : "Never"
              }
            />
          </dl>
        </DashboardSection>

        <DashboardSection title="Marketing" eyebrow="SEO & listings">
          <dl className="space-y-1.5 text-sm">
            <Row k="Meta title" v={property.metaTitle ?? "—"} />
            <Row
              k="Meta description"
              v={property.metaDescription ?? "—"}
            />
            <Row
              k="Virtual tour"
              v={property.virtualTourUrl ?? "—"}
            />
            <Row k="Price range" v={priceRange} />
          </dl>
          {property.description ? (
            <div className="pt-3 mt-3 border-t border-[var(--border-cream)]">
              <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)] mb-1">
                Description
              </div>
              <p className="text-xs text-[var(--olive-gray)] whitespace-pre-wrap">
                {property.description}
              </p>
            </div>
          ) : null}
        </DashboardSection>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-[var(--stone-gray)]">{k}</dt>
      <dd className="text-right truncate text-[var(--near-black)]">{v}</dd>
    </div>
  );
}
