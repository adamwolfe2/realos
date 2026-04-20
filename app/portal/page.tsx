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
  getActivityFeed,
  getAdSpendKpi,
  getFirstRunProgress,
  getFunnel,
  getHotVisitors,
  getIntegrationHealth,
  getLeadSourceBreakdown,
  getLeadStatusCounts,
  getOrganicSessionsKpi,
  getPropertyMetrics,
} from "@/lib/dashboard/queries";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// /portal — Operator Dashboard
//
// Single-screen consolidation of KPIs, lead source mix, conversion funnel,
// per-property cards, live activity feed, and integration health. Every tile
// is now backed by real Prisma queries (see /lib/dashboard/queries.ts).
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
    toursPrev28d,
    applicationsSubmitted28d,
    properties,
    hotVisitors,
    adSpend,
    organic,
    leadSourceSlices,
    funnelStages,
    activity,
    integrationChips,
    statusCounts,
    firstRun,
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
    prisma.tour.count({
      where: {
        status: TourStatus.SCHEDULED,
        lead: where,
        createdAt: {
          gte: new Date(Date.now() - 56 * DAY),
          lt: since28d,
        },
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
    getHotVisitors(scope.orgId),
    getAdSpendKpi(scope.orgId),
    getOrganicSessionsKpi(scope.orgId),
    getLeadSourceBreakdown(scope.orgId),
    getFunnel(scope.orgId),
    getActivityFeed(scope.orgId, 10),
    getIntegrationHealth(scope.orgId),
    getLeadStatusCounts(scope.orgId),
    getFirstRunProgress(scope.orgId),
  ]);

  // 28d leads + active campaigns + sparkline per property.
  const propertyMetrics = await getPropertyMetrics(
    scope.orgId,
    properties.map((p) => p.id),
  );

  // Realistic delta calc: % change vs previous 28d window.
  const leadsDeltaPct =
    leadsPrev28d > 0
      ? Math.round(((leadsNew28d - leadsPrev28d) / leadsPrev28d) * 100)
      : null;

  const toursDeltaPct =
    toursPrev28d > 0
      ? Math.round(((toursScheduled - toursPrev28d) / toursPrev28d) * 100)
      : null;

  // Cost per lead. Show "—" when there are no leads in the window so the tile
  // doesn't render an infinity-shaped number.
  const costPerLead = leadsNew28d > 0 ? adSpend.spendUsd / leadsNew28d : null;
  const costPerLeadDisplay =
    costPerLead != null ? `$${costPerLead.toFixed(2)}` : "\u2014";

  // Build a 28d daily-leads sparkline from the per-property buckets so the
  // top KPI shows the same shape the per-property cards add up to.
  const totalLeadsSpark = new Array<number>(28).fill(0);
  for (const m of propertyMetrics.values()) {
    for (let i = 0; i < totalLeadsSpark.length && i < m.leadsSpark.length; i++) {
      totalLeadsSpark[i] += m.leadsSpark[i];
    }
  }

  const showFirstRun = leadsTotal === 0 && propertiesCount === 0;

  // First-run checklist mirrors what we know about real onboarding state.
  const firstRunItems = DEFAULT_FIRST_RUN_ITEMS.map((it) => ({
    ...it,
    done:
      it.id === "property"
        ? firstRun.hasProperty
        : it.id === "pixel"
          ? firstRun.pixelInstalled
          : it.id === "seo"
            ? firstRun.gscConnected
            : it.id === "site"
              ? firstRun.marketingSiteCustomized
              : false,
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
              spark={totalLeadsSpark}
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
              label="Hot visitors now"
              value={hotVisitors.count.toLocaleString()}
              hint="Active in the last 5 minutes"
              spark={hotVisitors.sparkline}
              icon={<Flame className="h-3.5 w-3.5" />}
              live
              href="/portal/visitors"
            />
            <KpiTile
              label="Tour requests"
              value={toursScheduled.toLocaleString()}
              hint={`${applicationsSubmitted28d.toLocaleString()} apps in 28d`}
              icon={<CalendarCheck className="h-3.5 w-3.5" />}
              delta={
                toursDeltaPct != null
                  ? {
                      value: `${toursDeltaPct >= 0 ? "+" : ""}${toursDeltaPct}%`,
                      trend:
                        toursDeltaPct > 0
                          ? "up"
                          : toursDeltaPct < 0
                            ? "down"
                            : "flat",
                    }
                  : undefined
              }
              href="/portal/leads"
            />
            <KpiTile
              label="Ad spend"
              value={`$${adSpend.spendUsd.toLocaleString()}`}
              hint="Blended Google + Meta (28d)"
              spark={adSpend.sparkline}
              icon={<DollarSign className="h-3.5 w-3.5" />}
              delta={
                adSpend.deltaPct != null
                  ? {
                      value: `${adSpend.deltaPct >= 0 ? "+" : ""}${adSpend.deltaPct}%`,
                      trend:
                        adSpend.deltaPct > 0
                          ? "up"
                          : adSpend.deltaPct < 0
                            ? "down"
                            : "flat",
                    }
                  : undefined
              }
              href="/portal/campaigns"
            />
            <KpiTile
              label="Cost per lead"
              value={costPerLeadDisplay}
              hint={
                costPerLead != null
                  ? "Blended across all sources"
                  : "No leads in window"
              }
              icon={<Coins className="h-3.5 w-3.5" />}
              href="/portal/campaigns"
            />
            <KpiTile
              label="Organic sessions"
              value={organic.sessions.toLocaleString()}
              hint="From GSC + GA4"
              spark={organic.sparkline}
              icon={<Search className="h-3.5 w-3.5" />}
              delta={
                organic.deltaPct != null
                  ? {
                      value: `${organic.deltaPct >= 0 ? "+" : ""}${organic.deltaPct}%`,
                      trend:
                        organic.deltaPct > 0
                          ? "up"
                          : organic.deltaPct < 0
                            ? "down"
                            : "flat",
                    }
                  : undefined
              }
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
              <LeadSourceDonut slices={leadSourceSlices} />
            </DashboardSection>

            <DashboardSection
              eyebrow="From visit to signed"
              title="Conversion funnel"
              description="Drop-off at each stage. Click a stage to drill in."
              href="/portal/leads"
              className="lg:col-span-3"
            >
              <ConversionFunnel
                stages={funnelStages.map((s) => ({
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
                  {properties.map((p) => {
                    const metrics = propertyMetrics.get(p.id) ?? {
                      leads28d: 0,
                      leadsSpark: new Array<number>(28).fill(0),
                      activeCampaigns: 0,
                    };
                    const address = [p.addressLine1, p.city, p.state]
                      .filter(Boolean)
                      .join(", ");
                    const occupancyPct = p.totalUnits
                      ? Math.round(
                          ((p.totalUnits - (p.availableCount ?? 0)) /
                            p.totalUnits) *
                            100,
                        )
                      : null;
                    return (
                      <PropertyDashboardCard
                        key={p.id}
                        id={p.id}
                        name={p.name}
                        address={address || null}
                        thumbnailUrl={p.heroImageUrl}
                        occupancyPct={occupancyPct}
                        leads28d={metrics.leads28d}
                        leadsSpark={metrics.leadsSpark}
                        activeCampaigns={metrics.activeCampaigns}
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
              <ActivityFeed items={activity} />
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
            <IntegrationHealth chips={integrationChips} />
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
