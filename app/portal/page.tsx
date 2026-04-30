import type { Metadata } from "next";
import {
  Users,
  Flame,
  CalendarCheck,
  DollarSign,
  Coins,
  Search,
  Star,
  Bot,
  Brush,
  FileText,
  Gauge,
  TrendingUp,
  Share2,
  Megaphone,
  MessageSquare,
  Building2,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import {
  ApplicationStatus,
  LeadStatus,
  ProductLine,
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
  getReputationSummary,
  getChatbotSummary,
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
  // AUDIENCE_SYNC orgs and AL partners use the dedicated audiences surface;
  // the student-housing dashboard isn't relevant to them.
  if (scope.productLine === ProductLine.AUDIENCE_SYNC || scope.isAlPartner) {
    redirect("/portal/audiences");
  }
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
    applicationsAwaitingReview,
    toursRequestedCount,
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
    reputationSummary,
    chatbotSummary,
    orgModules,
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
    prisma.application.count({
      where: {
        lead: where,
        OR: [
          { status: ApplicationStatus.SUBMITTED },
          { status: ApplicationStatus.UNDER_REVIEW },
        ],
      },
    }),
    prisma.tour.count({
      where: { lead: where, status: TourStatus.REQUESTED },
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
    getReputationSummary(scope.orgId),
    getChatbotSummary(scope.orgId),
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: {
        moduleChatbot: true,
        moduleSEO: true,
        moduleGoogleAds: true,
        moduleMetaAds: true,
        moduleCreativeStudio: true,
        moduleReferrals: true,
        moduleWebsite: true,
        bringYourOwnSite: true,
      },
    }),
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

  // Portfolio occupancy: weighted by units. Some properties may not have
  // unit-count metadata yet, so we filter to those that do for accuracy.
  let portfolioTotalUnits = 0;
  let portfolioAvailableUnits = 0;
  for (const p of properties) {
    if (p.totalUnits && p.totalUnits > 0) {
      portfolioTotalUnits += p.totalUnits;
      portfolioAvailableUnits += p.availableCount ?? 0;
    }
  }
  const portfolioOccupancyPct =
    portfolioTotalUnits > 0
      ? Math.round(
          ((portfolioTotalUnits - portfolioAvailableUnits) /
            portfolioTotalUnits) *
            100
        )
      : null;

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
    <div className="space-y-4">
      {/* Setup wizard overlay — floats above dashboard, dismissed via localStorage */}
      <SetupWizardGate shouldShow={showFirstRun} steps={wizardSteps} />

      <SetupBanner forceShow={forceShowSetup} />

      {/* Unreviewed reputation alert — surfaces buried action items.
          Reputation Scanner used to be hidden in property detail tabs. This
          banner makes it impossible to miss when there's something to act on. */}
      {reputationSummary.unreviewedCount > 0 ? (
        <Link
          href="/portal/reputation"
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 hover:bg-amber-100 transition-colors group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-900 truncate">
                {reputationSummary.unreviewedCount.toLocaleString()} unreviewed
                {" "}
                {reputationSummary.unreviewedCount === 1 ? "mention" : "mentions"}
                {reputationSummary.negativeCount > 0
                  ? ` · ${reputationSummary.negativeCount} negative`
                  : ""}
              </p>
              <p className="text-[11px] text-amber-800">
                Triage Google reviews, Reddit threads, and Yelp posts before they snowball.
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-amber-900 group-hover:text-amber-950 whitespace-nowrap">
            Review →
          </span>
        </Link>
      ) : null}

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

      {/* KPI strip — eight tiles across at desktop, wraps on smaller screens.
          Surfaces brand-health (reputation) and chatbot ROI directly so they
          aren't buried in per-property pages. */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3"
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
            <KpiTile
              label="Avg Google rating"
              value={
                reputationSummary.avgGoogleRating != null
                  ? reputationSummary.avgGoogleRating.toFixed(1)
                  : "—"
              }
              hint={
                reputationSummary.googleReviewCount > 0
                  ? `${reputationSummary.googleReviewCount.toLocaleString()} reviews · ${reputationSummary.newLast30d} new (30d)`
                  : "No reviews yet"
              }
              icon={<Star className="h-3.5 w-3.5" />}
              href="/portal/reputation"
              delta={
                reputationSummary.negativeCount > 0
                  ? {
                      value: `${reputationSummary.negativeCount} neg`,
                      trend: "down",
                    }
                  : undefined
              }
            />
            <KpiTile
              label="Chatbot capture"
              value={
                chatbotSummary.captureRatePct != null
                  ? `${chatbotSummary.captureRatePct}%`
                  : "—"
              }
              hint={`${chatbotSummary.leadsCaptured28d} leads · ${chatbotSummary.conversations28d} chats (28d)`}
              icon={<Bot className="h-3.5 w-3.5" />}
              href="/portal/conversations"
              locked={
                !orgModules?.moduleChatbot
                  ? {
                      reason: "Chatbot module disabled",
                      href: "/portal/settings",
                    }
                  : undefined
              }
              delta={
                chatbotSummary.deltaPct != null
                  ? {
                      value: `${chatbotSummary.deltaPct >= 0 ? "+" : ""}${chatbotSummary.deltaPct}%`,
                      trend:
                        chatbotSummary.deltaPct > 0
                          ? "up"
                          : chatbotSummary.deltaPct < 0
                            ? "down"
                            : "flat",
                    }
                  : undefined
              }
            />
          </section>

          {/* Performance row */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
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
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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

          {/* Portfolio summary strip — occupancy + total units + active
              campaigns. Sized between KPIs and property cards so it visually
              ties them together. */}
          {portfolioTotalUnits > 0 ? (
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiTile
                label="Portfolio occupancy"
                value={
                  portfolioOccupancyPct != null
                    ? `${portfolioOccupancyPct}%`
                    : "—"
                }
                hint={`${(portfolioTotalUnits - portfolioAvailableUnits).toLocaleString()} of ${portfolioTotalUnits.toLocaleString()} occupied`}
                icon={<Building2 className="h-3.5 w-3.5" />}
                href="/portal/properties"
              />
              <KpiTile
                label="Available units"
                value={portfolioAvailableUnits.toLocaleString()}
                hint="Across all properties"
                icon={<Building2 className="h-3.5 w-3.5" />}
                href="/portal/properties"
              />
              <KpiTile
                label="Properties"
                value={propertiesCount.toLocaleString()}
                hint={`${properties.length === propertiesCount ? "All shown below" : `Showing ${properties.length}`}`}
                icon={<Building2 className="h-3.5 w-3.5" />}
                href="/portal/properties"
              />
              <KpiTile
                label="Active campaigns"
                value={Array.from(propertyMetrics.values())
                  .reduce((sum, m) => sum + m.activeCampaigns, 0)
                  .toLocaleString()}
                hint="Google + Meta combined"
                icon={<Megaphone className="h-3.5 w-3.5" />}
                href="/portal/campaigns"
                locked={
                  adsOff
                    ? {
                        reason: "Requires Google Ads or Meta",
                        href: "/portal/settings/integrations",
                      }
                    : undefined
                }
              />
            </section>
          ) : null}

          {/* Properties + activity feed */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
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
                      reputationMentionCount: 0,
                      reputationNegativeCount: 0,
                      reputationUnreviewedCount: 0,
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
                        reputationMentionCount={metrics.reputationMentionCount}
                        reputationNegativeCount={metrics.reputationNegativeCount}
                        reputationUnreviewedCount={metrics.reputationUnreviewedCount}
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

          {/* Quick access — surfaces every feature one click away from the
              dashboard. Used to be invisible: Reputation/Briefing/Site
              Builder/Reports were 2-3 clicks deep with no homepage entry. */}
          <DashboardSection
            eyebrow="One click away"
            title="Quick access"
            description="Jump straight to any module from the dashboard"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              <QuickAccessTile
                href="/portal/reputation"
                label="Reputation"
                icon={<Star className="h-4 w-4" />}
                meta={
                  reputationSummary.totalMentions > 0
                    ? `${reputationSummary.totalMentions} mentions`
                    : "Run a scan"
                }
                badge={
                  reputationSummary.unreviewedCount > 0
                    ? reputationSummary.unreviewedCount
                    : null
                }
              />
              <QuickAccessTile
                href="/portal/tours"
                label="Tours"
                icon={<CalendarCheck className="h-4 w-4" />}
                meta={
                  toursScheduled > 0
                    ? `${toursScheduled} scheduled`
                    : "Calendar + pipeline"
                }
                badge={toursRequestedCount > 0 ? toursRequestedCount : null}
                badgeTone={toursRequestedCount > 0 ? "rose" : undefined}
              />
              <QuickAccessTile
                href="/portal/applications"
                label="Applications"
                icon={<ClipboardList className="h-4 w-4" />}
                meta={
                  applicationsSubmitted28d > 0
                    ? `${applicationsSubmitted28d} this month`
                    : "Pipeline"
                }
                badge={
                  applicationsAwaitingReview > 0
                    ? applicationsAwaitingReview
                    : null
                }
                badgeTone={
                  applicationsAwaitingReview > 0 ? "rose" : undefined
                }
              />
              <QuickAccessTile
                href="/portal/briefing"
                label="AI Briefing"
                icon={<Gauge className="h-4 w-4" />}
                meta="Daily digest"
              />
              <QuickAccessTile
                href="/portal/insights"
                label="Insights"
                icon={<Sparkles className="h-4 w-4" />}
                meta={
                  insightCounts.total > 0
                    ? `${insightCounts.total} open signals`
                    : "All clear"
                }
                badge={insightCounts.critical > 0 ? insightCounts.critical : null}
                badgeTone={insightCounts.critical > 0 ? "rose" : undefined}
              />
              <QuickAccessTile
                href="/portal/reports"
                label="Reports"
                icon={<FileText className="h-4 w-4" />}
                meta="Weekly + monthly"
              />
              {orgModules?.moduleChatbot ? (
                <QuickAccessTile
                  href="/portal/conversations"
                  label="Conversations"
                  icon={<MessageSquare className="h-4 w-4" />}
                  meta={`${chatbotSummary.conversations28d} in 28d`}
                />
              ) : null}
              {orgModules?.moduleSEO ? (
                <QuickAccessTile
                  href="/portal/seo"
                  label="SEO"
                  icon={<TrendingUp className="h-4 w-4" />}
                  meta={`${organic.sessions.toLocaleString()} sessions`}
                />
              ) : null}
              {(orgModules?.moduleGoogleAds || orgModules?.moduleMetaAds) ? (
                <QuickAccessTile
                  href="/portal/campaigns"
                  label="Campaigns"
                  icon={<Megaphone className="h-4 w-4" />}
                  meta={`$${adSpend.spendUsd.toLocaleString()} spend`}
                />
              ) : null}
              {orgModules?.moduleCreativeStudio ? (
                <QuickAccessTile
                  href="/portal/creative"
                  label="Creative studio"
                  icon={<Brush className="h-4 w-4" />}
                  meta="Ad assets"
                />
              ) : null}
              {orgModules?.moduleWebsite && !orgModules?.bringYourOwnSite ? (
                <QuickAccessTile
                  href="/portal/site-builder"
                  label="Site builder"
                  icon={<Brush className="h-4 w-4" />}
                  meta="Edit your site"
                />
              ) : null}
              {orgModules?.moduleReferrals ? (
                <QuickAccessTile
                  href="/portal/referrals"
                  label="Referrals"
                  icon={<Share2 className="h-4 w-4" />}
                  meta="Track referrers"
                />
              ) : null}
            </div>
          </DashboardSection>

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

// One-click feature shortcut. Compact tile with icon + label + secondary
// metric. Optional badge (e.g. unreviewed count, critical insight count).
function QuickAccessTile({
  href,
  label,
  icon,
  meta,
  badge,
  badgeTone,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  meta?: string;
  badge?: number | null;
  badgeTone?: "rose";
}) {
  const badgeClass =
    badgeTone === "rose"
      ? "bg-rose-100 text-rose-700"
      : "bg-primary/10 text-primary";
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 hover:border-primary/40 transition-all px-3 py-2.5 min-w-0"
    >
      <span className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md bg-muted text-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-foreground truncate">
          {label}
        </span>
        {meta ? (
          <span className="block text-[10px] text-muted-foreground truncate">
            {meta}
          </span>
        ) : null}
      </span>
      {badge != null && badge > 0 ? (
        <span
          className={`shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-semibold tabular-nums ${badgeClass}`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
