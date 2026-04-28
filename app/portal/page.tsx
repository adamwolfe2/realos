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
import { SetupWizardGate } from "@/components/portal/onboarding/setup-wizard-gate";

import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { LeadSourceDonut } from "@/components/portal/dashboard/lead-source-donut";
import { ConversionFunnel } from "@/components/portal/dashboard/conversion-funnel";
import { PropertyDashboardCard } from "@/components/portal/dashboard/property-card";
import { ActivityFeed } from "@/components/portal/dashboard/activity-feed";
import { IntegrationHealth } from "@/components/portal/dashboard/integration-health";
import {
  getActivityFeed,
  getAdSpendKpi,
  getFirstRunProgress,
  getFunnel,
  getHotVisitors,
  getIntegrationHealth,
  getLeadSourceBreakdown,
  getLeasingVelocityTrend,
  getLeadStatusCounts,
  getOrganicSessionsKpi,
  getPropertyMetrics,
  getRecentIdentifiedVisitors,
  getReputationPulse,
} from "@/lib/dashboard/queries";
import { LeasingVelocityChart } from "@/components/portal/dashboard/leasing-velocity-chart";
import { RecentIdentifiedVisitors } from "@/components/portal/dashboard/recent-identified-visitors";
import { ReputationPulse } from "@/components/portal/dashboard/reputation-pulse";
import { getOpenInsights, getInsightCounts } from "@/lib/insights/queries";
import { InsightCard, type InsightCardData } from "@/components/portal/insights/insight-card";
import { Sparkles } from "lucide-react";
import Link from "next/link";

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
    openInsights,
    insightCounts,
    velocityData,
    recentIdentified,
    reputationPulse,
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
    getOpenInsights(scope.orgId, { limit: 3 }),
    getInsightCounts(scope.orgId),
    getLeasingVelocityTrend(scope.orgId),
    getRecentIdentifiedVisitors(scope.orgId, 6),
    getReputationPulse(scope.orgId, 5),
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

  const wizardSteps = [
    {
      id: "property",
      title: "Add your first property",
      description:
        "Properties are the foundation — everything else maps to them.",
      actionLabel: "Add property",
      actionHref: "/portal/properties/new",
      done: firstRun.hasProperty,
    },
    {
      id: "pixel",
      title: "Install the tracking pixel",
      description:
        "See live visitors, traffic sources, and engagement in real time.",
      actionLabel: "Set up pixel",
      actionHref: "/portal/settings/integrations",
      done: firstRun.pixelInstalled,
    },
    {
      id: "seo",
      title: "Connect Google Analytics",
      description:
        "Pull organic sessions and top landing pages into your dashboard.",
      actionLabel: "Connect GA4",
      actionHref: "/portal/settings/integrations",
      done: firstRun.gscConnected,
    },
    {
      id: "site",
      title: "Customize your marketing site",
      description: "Set your headline, hero image, and primary CTA link.",
      actionLabel: "Customize site",
      actionHref: "/portal/site",
      done: firstRun.marketingSiteCustomized,
    },
  ];

  const cursiveOff = integrationChips.find((c) => c.key === "cursive")?.status === "off";
  const adsOff =
    integrationChips.find((c) => c.key === "google-ads")?.status === "off" &&
    integrationChips.find((c) => c.key === "meta-ads")?.status === "off";
  const organicOff =
    integrationChips.find((c) => c.key === "gsc")?.status === "off" &&
    integrationChips.find((c) => c.key === "ga4")?.status === "off";

  return (
    <div className="space-y-5">
      {/* Setup wizard overlay — floats above dashboard, dismissed via localStorage */}
      <SetupWizardGate shouldShow={showFirstRun} steps={wizardSteps} />

      <SetupBanner forceShow={forceShowSetup} />

      {/* Data sources bar */}
      {integrationChips.length > 0 ? (
        <IntegrationHealth chips={integrationChips} />
      ) : null}

      {/* Insights strip — opens the day with what changed, if anything */}
      {insightCounts.total > 0 ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                Signal
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {insightCounts.critical > 0
                  ? `${insightCounts.critical} critical, ${insightCounts.warning} warning`
                  : insightCounts.warning > 0
                    ? `${insightCounts.warning} warning, ${insightCounts.info} info`
                    : `${insightCounts.info} info signals open`}
              </h2>
            </div>
            <Link
              href="/portal/insights"
              className="text-xs font-medium text-foreground hover:text-primary"
            >
              See all
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(openInsights as InsightCardData[]).map((insight) => (
              <InsightCard
                key={insight.id}
                insight={{
                  ...insight,
                  context: (insight.context as Record<string, unknown>) ?? null,
                }}
                dense
              />
            ))}
          </div>
        </section>
      ) : null}

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
              locked={cursiveOff ? { reason: "Requires pixel", href: "/portal/settings/integrations" } : undefined}
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
              locked={adsOff ? { reason: "Requires Google Ads or Meta", href: "/portal/settings/integrations" } : undefined}
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
              locked={adsOff ? { reason: "Requires Google Ads or Meta", href: "/portal/settings/integrations" } : undefined}
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
              locked={organicOff ? { reason: "Requires GSC or GA4", href: "/portal/settings/integrations" } : undefined}
            />
          </section>

          {/* Performance row */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

          {/* Leasing velocity trend */}
          <DashboardSection
            eyebrow="Week over week"
            title="Leasing velocity"
            description="Leads, tours, and applications for the last 12 weeks. The shape tells you if momentum is building or stalling."
            href="/portal/leads"
          >
            <LeasingVelocityChart data={velocityData} />
          </DashboardSection>

          {/* Recent identified visitors + reputation pulse */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DashboardSection
              eyebrow="Pixel resolved"
              title="Recently identified visitors"
              description="Real people who hit your site, resolved by name and email"
              href="/portal/visitors"
              hrefLabel="See all visitors"
            >
              <RecentIdentifiedVisitors visitors={recentIdentified} />
            </DashboardSection>

            <DashboardSection
              eyebrow="What people are saying"
              title="Reputation pulse"
              description="Latest reviews and mentions across Google, Reddit, Yelp, and the open web"
              href={
                reputationPulse[0]
                  ? `/portal/properties/${reputationPulse[0].propertyId}?tab=reputation`
                  : "/portal/properties"
              }
              hrefLabel="Open reputation"
            >
              <ReputationPulse items={reputationPulse} />
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
                <p className="text-xs text-muted-foreground">
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

          {/* Funnel rollup mini-stat (uses real status counts so operator sees
              live pipeline shape even before the funnel above is wired). */}
          <section className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
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
                className="rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <div className="text-xs tracking-widest uppercase font-semibold text-muted-foreground">
                  {s.label}
                </div>
                <div className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                  {s.count.toLocaleString()}
                </div>
              </div>
            ))}
      </section>
    </div>
  );
}
