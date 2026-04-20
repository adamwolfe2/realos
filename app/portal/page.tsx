import type { Metadata } from "next";
import {
  Users,
  Flame,
  CalendarCheck,
  DollarSign,
  Coins,
  Search,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import {
  ApplicationStatus,
  LeadStatus,
  TourStatus,
} from "@prisma/client";
import { SetupBanner } from "@/components/portal/setup/setup-banner";

import { DashboardHeader } from "@/components/portal/dashboard/dashboard-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { LeadSourceDonut } from "@/components/portal/dashboard/lead-source-donut";
import { ConversionFunnel } from "@/components/portal/dashboard/conversion-funnel";
import { PropertyDashboardCard } from "@/components/portal/dashboard/property-card";
import { ActivityFeed } from "@/components/portal/dashboard/activity-feed";
import { IntegrationHealth } from "@/components/portal/dashboard/integration-health";
import {
  FirstRunChecklist,
  DEFAULT_FIRST_RUN_ITEMS,
} from "@/components/portal/dashboard/first-run-checklist";
import {
  PLACEHOLDER_LEAD_SOURCES,
  PLACEHOLDER_FUNNEL,
  SPARK_LEADS_28D,
  SPARK_TOURS_28D,
  SPARK_SPEND_28D,
  SPARK_ORGANIC_28D,
  PLACEHOLDER_AD_SPEND_28D_USD,
  PLACEHOLDER_BLENDED_CPL_USD,
  PLACEHOLDER_HOT_VISITORS,
  PLACEHOLDER_ORGANIC_SESSIONS_28D,
  PLACEHOLDER_ACTIVITY,
  PLACEHOLDER_INTEGRATIONS,
  PROPERTY_PLACEHOLDER_BUCKET,
} from "@/components/portal/dashboard/placeholder-data";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// /portal — Operator Dashboard
//
// Single-screen consolidation: KPIs, lead source mix, conversion funnel,
// per-property cards, live activity feed, integration health.
//
// REAL data wired today:
//   - Lead counts (28d + all-time)
//   - Tours scheduled
//   - Applications submitted
//   - Properties (name, address, hero image, lastSync, AppFolio status)
//   - Workspace identity (logo, primaryColor, name)
//   - Setup progress banner
//
// PLACEHOLDER data (swap when sibling agents land their work):
//   - Hot visitors right now           -> Cursive pixel agent
//   - Lead source breakdown / funnel   -> aggregate from Lead.source over 28d
//   - Ad spend + blended CPL           -> Google + Meta ad agents
//   - Organic sessions                 -> SEO agent (GSC/GA4)
//   - Activity feed                    -> event store (cross-agent)
//   - Integration health chips         -> per-integration status query
//   - Per-property occupancy + active  -> AppFolio sync + AdCampaign queries
//     campaign count + leads sparkline
// ---------------------------------------------------------------------------

export default async function PortalHome({
  searchParams,
}: {
  searchParams: Promise<{ showSetup?: string }>;
}) {
  const scope = await requireScope();
  const { showSetup } = await searchParams;
  const forceShowSetup = showSetup === "1";
  const since28d = new Date(Date.now() - 28 * DAY);
  const where = tenantWhere<{ orgId?: string }>(scope);

  const [
    org,
    propertiesCount,
    leadsTotal,
    leadsNew28d,
    leadsPrev28d,
    toursScheduled,
    applicationsSubmitted28d,
    properties,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { id: true, name: true, logoUrl: true, primaryColor: true },
    }),
    prisma.property.count({ where }),
    prisma.lead.count({ where }),
    prisma.lead.count({
      where: { ...where, createdAt: { gte: since28d } },
    }),
    prisma.lead.count({
      where: {
        ...where,
        createdAt: {
          gte: new Date(Date.now() - 56 * DAY),
          lt: since28d,
        },
      },
    }),
    prisma.tour.count({
      where: {
        status: TourStatus.SCHEDULED,
        lead: where,
      },
    }),
    prisma.application.count({
      where: {
        status: ApplicationStatus.SUBMITTED,
        lead: where,
        createdAt: { gte: since28d },
      },
    }),
    prisma.property.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        addressLine1: true,
        city: true,
        state: true,
        heroImageUrl: true,
        availableCount: true,
        totalUnits: true,
      },
    }),
  ]);

  const leadsByStatus = await prisma.lead.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });
  const statusCounts = new Map<LeadStatus, number>();
  for (const row of leadsByStatus) {
    statusCounts.set(row.status, row._count._all);
  }

  // Realistic delta calc: % change vs previous 28d window.
  const leadsDeltaPct =
    leadsPrev28d > 0
      ? Math.round(((leadsNew28d - leadsPrev28d) / leadsPrev28d) * 100)
      : null;

  const showFirstRun = leadsTotal === 0 && propertiesCount === 0;

  // First-run checklist mirrors the data we already know about. As more
  // pieces light up (pixel install, SEO sync, etc.), update `done` per item.
  const firstRunItems = DEFAULT_FIRST_RUN_ITEMS.map((it) => ({
    ...it,
    done:
      it.id === "property"
        ? propertiesCount > 0
        : false, // other steps wired by sibling agents
  }));

  return (
    <div className="space-y-5">
      <SetupBanner forceShow={forceShowSetup} />

      <DashboardHeader
        workspaceName={org?.name ?? "Workspace"}
        workspaceLogoUrl={org?.logoUrl}
        primaryColor={org?.primaryColor}
        rangeLabel="Last 28 days"
      />

      {showFirstRun ? (
        <FirstRunChecklist items={firstRunItems} />
      ) : (
        <>
          {/* KPI strip — six tiles across at desktop, wraps on smaller screens */}
          <section
            aria-label="Key metrics"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
          >
            <KpiTile
              label="Total leads"
              value={leadsNew28d.toLocaleString()}
              hint={`${leadsTotal.toLocaleString()} all-time`}
              spark={SPARK_LEADS_28D}
              icon={<Users className="h-3.5 w-3.5" />}
              delta={
                leadsDeltaPct != null
                  ? {
                      value: `${leadsDeltaPct >= 0 ? "+" : ""}${leadsDeltaPct}%`,
                      trend:
                        leadsDeltaPct > 0
                          ? "up"
                          : leadsDeltaPct < 0
                            ? "down"
                            : "flat",
                    }
                  : undefined
              }
              href="/portal/leads"
            />
            <KpiTile
              label="Hot leads now"
              value={PLACEHOLDER_HOT_VISITORS}
              hint="Identified visitors on site"
              icon={<Flame className="h-3.5 w-3.5" />}
              live
              href="/portal/visitors"
            />
            <KpiTile
              label="Tour requests"
              value={toursScheduled.toLocaleString()}
              hint={`${applicationsSubmitted28d.toLocaleString()} apps in 28d`}
              spark={SPARK_TOURS_28D}
              icon={<CalendarCheck className="h-3.5 w-3.5" />}
              delta={{ value: "+18%", trend: "up" }}
              href="/portal/leads"
            />
            <KpiTile
              label="Ad spend"
              value={`$${PLACEHOLDER_AD_SPEND_28D_USD.toLocaleString()}`}
              hint="Blended Google + Meta"
              spark={SPARK_SPEND_28D}
              icon={<DollarSign className="h-3.5 w-3.5" />}
              delta={{ value: "+9%", trend: "up" }}
              href="/portal/campaigns"
            />
            <KpiTile
              label="Cost per lead"
              value={`$${PLACEHOLDER_BLENDED_CPL_USD.toFixed(2)}`}
              hint="Blended across all sources"
              icon={<Coins className="h-3.5 w-3.5" />}
              delta={{ value: "-7%", trend: "up" }}
              href="/portal/campaigns"
            />
            <KpiTile
              label="Organic sessions"
              value={PLACEHOLDER_ORGANIC_SESSIONS_28D.toLocaleString()}
              hint="From GSC + GA4"
              spark={SPARK_ORGANIC_28D}
              icon={<Search className="h-3.5 w-3.5" />}
              delta={{ value: "+22%", trend: "up" }}
              href="/portal/seo"
            />
          </section>

          {/* Performance row */}
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <DashboardSection
              eyebrow="Where leads come from"
              title="Lead source breakdown"
              description="Last 28 days · all properties"
              href="/portal/leads"
              className="lg:col-span-2"
            >
              <LeadSourceDonut slices={PLACEHOLDER_LEAD_SOURCES} />
            </DashboardSection>

            <DashboardSection
              eyebrow="From visit to signed"
              title="Conversion funnel"
              description="Drop-off at each stage. Click a stage to drill in."
              href="/portal/leads"
              className="lg:col-span-3"
            >
              <ConversionFunnel
                stages={PLACEHOLDER_FUNNEL.map((s) => ({
                  label: s.label,
                  value: s.value,
                }))}
              />
            </DashboardSection>
          </section>

          {/* Properties + activity feed */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <DashboardSection
              title="Properties"
              eyebrow="Portfolio"
              description="Performance per property over the last 28 days"
              href="/portal/properties"
              className="lg:col-span-2"
            >
              {properties.length === 0 ? (
                <p className="text-xs text-[var(--stone-gray)]">
                  No properties yet. Add one to start tracking leads, ads, and
                  occupancy here.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {properties.map((p, i) => {
                    const bucket =
                      PROPERTY_PLACEHOLDER_BUCKET[
                        i % PROPERTY_PLACEHOLDER_BUCKET.length
                      ];
                    const address = [p.addressLine1, p.city, p.state]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <PropertyDashboardCard
                        key={p.id}
                        id={p.id}
                        name={p.name}
                        address={address || null}
                        thumbnailUrl={p.heroImageUrl}
                        occupancyPct={
                          p.totalUnits
                            ? Math.round(
                                ((p.totalUnits - (p.availableCount ?? 0)) /
                                  p.totalUnits) *
                                  100,
                              )
                            : bucket.occupancyPct
                        }
                        leads28d={bucket.leads28d}
                        leadsSpark={bucket.leadsSpark}
                        activeCampaigns={bucket.activeCampaigns}
                        accent={org?.primaryColor ?? undefined}
                      />
                    );
                  })}
                </div>
              )}
            </DashboardSection>

            <DashboardSection
              eyebrow="Real-time"
              title="Live activity"
              description="Events from leads, tours, ads, and your chatbot"
              href="/portal/leads"
              hrefLabel="Open leads"
              className="lg:col-span-1"
            >
              <ActivityFeed items={PLACEHOLDER_ACTIVITY} />
            </DashboardSection>
          </section>

          {/* Integration health row */}
          <DashboardSection
            eyebrow="Connections"
            title="Integration health"
            description="Click any chip to fix or reconnect"
            href="/portal/settings"
            hrefLabel="Manage"
          >
            <IntegrationHealth chips={PLACEHOLDER_INTEGRATIONS} />
          </DashboardSection>

          {/* Funnel rollup mini-stat (uses real status counts so operator sees
              live pipeline shape even before the funnel above is wired). */}
          <section className="grid grid-cols-2 md:grid-cols-7 gap-2">
            {[
              { label: "New", count: statusCounts.get(LeadStatus.NEW) ?? 0 },
              { label: "Contacted", count: statusCounts.get(LeadStatus.CONTACTED) ?? 0 },
              { label: "Tour scheduled", count: statusCounts.get(LeadStatus.TOUR_SCHEDULED) ?? 0 },
              { label: "Toured", count: statusCounts.get(LeadStatus.TOURED) ?? 0 },
              { label: "Applied", count: statusCounts.get(LeadStatus.APPLIED) ?? 0 },
              { label: "Approved", count: statusCounts.get(LeadStatus.APPROVED) ?? 0 },
              { label: "Signed", count: statusCounts.get(LeadStatus.SIGNED) ?? 0 },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-[var(--border-cream)] bg-[var(--ivory)] px-3 py-2.5"
              >
                <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
                  {s.label}
                </div>
                <div className="mt-0.5 text-base font-semibold tabular-nums text-[var(--near-black)]">
                  {s.count.toLocaleString()}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
