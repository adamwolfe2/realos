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
  Megaphone,
  MessageSquare,
  Building2,
  AlertTriangle,
  ClipboardList,
  Wrench,
  Home,
  CalendarClock,
} from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  effectivePropertyIds,
  isAccessDenied,
  parsePropertyFilter,
  propertyWhereFragment,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import {
  ApplicationStatus,
  LeaseStatus,
  ProductLine,
  ResidentStatus,
  TourStatus,
  WorkOrderStatus,
  WorkOrderPriority,
} from "@prisma/client";
import { SetupBanner } from "@/components/portal/setup/setup-banner";
import { SetupWizardGate } from "@/components/portal/onboarding/setup-wizard-gate";
import { AutoRefresh } from "@/components/portal/sync/auto-refresh";

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
import { InsightsHero } from "@/components/portal/dashboard/insights-hero";
import { countConnectedSources } from "@/lib/connect/status";
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
  searchParams: Promise<{
    showSetup?: string;
    property?: string;
    properties?: string;
  }>;
}) {
  const scope = await requireScope();
  // AUDIENCE_SYNC orgs and AL partners use the dedicated audiences surface;
  // the student-housing dashboard isn't relevant to them.
  if (scope.productLine === ProductLine.AUDIENCE_SYNC || scope.isAlPartner) {
    redirect("/portal/audiences");
  }

  // Property-restricted users (UserPropertyAccess set, e.g. Norman →
  // Telegraph Commons only) skip the org-wide dashboard entirely:
  //   - 1 allowed → that property's detail page
  //   - 2+ allowed → /portal/properties list (gated in Phase 1b)
  // The helpers backing the dashboard tiles are not all property-aware
  // yet, so for restricted users we route to surfaces that ARE.
  if (scope.allowedPropertyIds !== null) {
    if (scope.allowedPropertyIds.length === 1) {
      redirect(`/portal/properties/${scope.allowedPropertyIds[0]}`);
    }
    redirect("/portal/properties");
  }

  const sp = await searchParams;
  const { showSetup } = sp;
  const forceShowSetup = showSetup === "1";

  // Property selector (Phase 4): unrestricted users (David, agency)
  // can narrow the dashboard to one or more properties via the
  // multi-select dropdown at the top. Direct-prisma KPI queries
  // honor the filter; helper functions that don't yet accept
  // propertyIds remain org-wide and are flagged in the UI.
  const requestedIds = parsePropertyFilter(sp);
  const accessDenied = isAccessDenied(scope, requestedIds);
  const effectiveIds = effectivePropertyIds(scope, requestedIds);
  const propertyClause = propertyWhereFragment(scope, requestedIds);
  const isFiltered = effectiveIds !== null && effectiveIds.length > 0;

  try {
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
    firstRun,
    openInsights,
    insightCounts,
    connectStatus,
    velocityData,
    recentIdentified,
    reputationPulse,
    reputationSummary,
    chatbotSummary,
    orgModules,
    rentRollSum,
    activeResidentsCount,
    noticeGivenCount,
    leasesExpiring120dCount,
    pastDueLeasesCount,
    pastDueBalance,
    openWorkOrdersCount,
    urgentWorkOrdersCount,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { id: true, name: true, logoUrl: true, primaryColor: true },
    }),
    // Marketable properties only — excludes parking lots, storage,
    // sub-records, and rows still pending operator review (IMPORTED).
    // Honors the property selector (effectiveIds) so the count matches
    // the visible scope.
    prisma.property.count({
      where: {
        ...marketablePropertyWhere(scope.orgId),
        ...(isFiltered ? { id: { in: effectiveIds! } } : {}),
      },
    }),
    prisma.lead.count({ where: { ...where, ...propertyClause } }),
    prisma.lead.count({
      where: { ...where, ...propertyClause, createdAt: { gte: since28d } },
    }),
    prisma.lead.count({
      where: {
        ...where,
        ...propertyClause,
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
        ...propertyClause,
      },
    }),
    prisma.tour.count({
      where: {
        status: TourStatus.SCHEDULED,
        lead: where,
        ...propertyClause,
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
        ...propertyClause,
        createdAt: { gte: since28d },
      },
    }),
    prisma.application.count({
      where: {
        lead: where,
        ...propertyClause,
        OR: [
          { status: ApplicationStatus.SUBMITTED },
          { status: ApplicationStatus.UNDER_REVIEW },
        ],
      },
    }),
    prisma.tour.count({
      where: { lead: where, ...propertyClause, status: TourStatus.REQUESTED },
    }),
    prisma.property.findMany({
      where: {
        ...where,
        ...(isFiltered ? { id: { in: effectiveIds! } } : {}),
      },
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
    // Helper-function calls — each wrapped in .catch() so a single
    // failure (missing AppFolio integration, schema migration not yet
    // applied, AL API outage) renders an empty section instead of
    // 500ing the whole dashboard. The previous behavior bounced
    // operators to the amber 'Dashboard data could not be loaded'
    // fallback when ANY one of these threw — meaning a single bad
    // PropertyMention row could blank the entire portal home.
    // Helper-function calls — each wrapped in .catch() with the
    // helper's actual return-type shape so a single failure (missing
    // integration, schema migration not yet applied, AL API outage)
    // renders an empty section instead of 500ing the whole dashboard.
    // Pre-fix the outer try/catch caught any failure and rendered the
    // amber "Dashboard data could not be loaded" panel — meaning one
    // broken PropertyMention or seo-snapshot query blanked the entire
    // portal home for that operator.
    getHotVisitors(scope.orgId).catch(() => ({
      count: 0,
      sparkline: new Array<number>(28).fill(0),
    })),
    getAdSpendKpi(scope.orgId).catch(() => ({
      spendUsd: 0,
      previousSpendUsd: 0,
      deltaPct: null as number | null,
      sparkline: new Array<number>(28).fill(0),
    })),
    getOrganicSessionsKpi(scope.orgId).catch(() => ({
      sessions: 0,
      previousSessions: 0,
      deltaPct: null as number | null,
      sparkline: new Array<number>(28).fill(0),
    })),
    getLeadSourceBreakdown(scope.orgId).catch(() => []),
    getFunnel(scope.orgId).catch(
      () => [] as Array<{ label: string; value: number }>,
    ),
    getActivityFeed(scope.orgId, 10).catch(() => []),
    getIntegrationHealth(scope.orgId).catch(() => []),
    getFirstRunProgress(scope.orgId).catch(() => ({
      hasProperty: false,
      pixelInstalled: false,
      gscConnected: false,
      marketingSiteCustomized: false,
    })),
    getOpenInsights(scope.orgId, { limit: 3 }).catch(() => []),
    getInsightCounts(scope.orgId).catch(() => ({
      total: 0,
      critical: 0,
      warning: 0,
      info: 0,
      open: 0,
    })),
    countConnectedSources(scope.orgId).catch(() => ({
      connected: 0,
      total: 7,
    })),
    getLeasingVelocityTrend(scope.orgId).catch(() => []),
    getRecentIdentifiedVisitors(scope.orgId, 6).catch(() => []),
    getReputationPulse(scope.orgId, 5).catch(() => []),
    getReputationSummary(scope.orgId).catch(() => ({
      avgGoogleRating: null as number | null,
      googleReviewCount: 0,
      totalMentions: 0,
      newLast30d: 0,
      negativeCount: 0,
      unreviewedCount: 0,
    })),
    getChatbotSummary(scope.orgId).catch(() => ({
      conversations28d: 0,
      leadsCaptured28d: 0,
      captureRatePct: null as number | null,
      prev28dConversations: 0,
      deltaPct: null as number | null,
    })),
    prisma.organization
      .findUnique({
        where: { id: scope.orgId },
        select: {
          moduleChatbot: true,
          modulePixel: true,
          moduleSEO: true,
          moduleGoogleAds: true,
          moduleMetaAds: true,
          moduleCreativeStudio: true,
          moduleReferrals: true,
          moduleWebsite: true,
          bringYourOwnSite: true,
        },
      })
      .catch(() => null),
    // AppFolio mirror metrics — each defaults to a zero-shape on
    // failure so the rent-roll / occupancy strip renders empty rather
    // than crashing the dashboard.
    prisma.lease
      .aggregate({
        where: { ...where, ...propertyClause, status: LeaseStatus.ACTIVE },
        _sum: { monthlyRentCents: true },
      })
      .catch(() => ({ _sum: { monthlyRentCents: 0 } })),
    prisma.resident
      .count({ where: { ...where, ...propertyClause, status: ResidentStatus.ACTIVE } })
      .catch(() => 0),
    prisma.resident
      .count({
        where: { ...where, ...propertyClause, status: ResidentStatus.NOTICE_GIVEN },
      })
      .catch(() => 0),
    prisma.lease
      .count({
        where: {
          ...where,
          ...propertyClause,
          status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
          endDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 120 * DAY),
          },
        },
      })
      .catch(() => 0),
    prisma.lease
      .count({ where: { ...where, ...propertyClause, isPastDue: true } })
      .catch(() => 0),
    prisma.lease
      .aggregate({
        where: { ...where, ...propertyClause, isPastDue: true },
        _sum: { currentBalanceCents: true },
      })
      .catch(() => ({ _sum: { currentBalanceCents: 0 } })),
    prisma.workOrder
      .count({
        where: {
          ...where,
          ...propertyClause,
          status: {
            in: [
              WorkOrderStatus.NEW,
              WorkOrderStatus.SCHEDULED,
              WorkOrderStatus.IN_PROGRESS,
              WorkOrderStatus.ON_HOLD,
            ],
          },
        },
      })
      .catch(() => 0),
    prisma.workOrder
      .count({
        where: {
          ...where,
          ...propertyClause,
          priority: WorkOrderPriority.URGENT,
          status: { not: WorkOrderStatus.COMPLETED },
        },
      })
      .catch(() => 0),
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

  // Format helper for AppFolio rent roll display
  const rentRollMonthly = rentRollSum._sum.monthlyRentCents ?? 0;
  const rentRollMonthlyDisplay =
    rentRollMonthly > 0
      ? `$${(rentRollMonthly / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : "—";
  const pastDueDisplay =
    (pastDueBalance._sum.currentBalanceCents ?? 0) > 0
      ? `$${((pastDueBalance._sum.currentBalanceCents ?? 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : null;

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

  // Wizard step actionHref routes — every URL is verified to exist as a
  // real Next.js route under /app/portal/. Pre-fix the wizard linked to
  // /portal/properties/new (404) and /portal/site (404), dead-ending the
  // most common first-action a brand-new operator takes. /portal/properties
  // renders the empty-state CTA + the PropertyFormDialog, so the dialog
  // opens with one click after navigation. /portal/site-builder is the
  // actual marketing-site editor surface.
  const wizardSteps = [
    {
      id: "property",
      title: "Add your first property",
      description:
        "Properties are the foundation — everything else maps to them.",
      actionLabel: "Add property",
      actionHref: "/portal/properties",
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
      actionHref: "/portal/site-builder",
      done: firstRun.marketingSiteCustomized,
    },
  ];

  const cursiveOff = integrationChips.find((c) => c.key === "cursive")?.status === "off";
  const appfolioChip = integrationChips.find((c) => c.key === "appfolio");
  const appfolioOff = appfolioChip?.status === "off";
  const appfolioDegraded = appfolioChip?.status === "degraded";
  const adsOff =
    integrationChips.find((c) => c.key === "google-ads")?.status === "off" &&
    integrationChips.find((c) => c.key === "meta-ads")?.status === "off";
  const organicOff =
    integrationChips.find((c) => c.key === "gsc")?.status === "off" &&
    integrationChips.find((c) => c.key === "ga4")?.status === "off";

  // Visible-property list for the multi-select dropdown.
  const allPropertiesForSelector = await prisma.property.findMany({
    where: marketablePropertyWhere(scope.orgId),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const selectorProperties = visibleProperties(scope, allPropertiesForSelector);

  return (
    <div className="space-y-2 ls-page-fade">
      {/* Auto-refresh dashboard data every 45s. Cheap — just re-runs the
          server-component Prisma queries against existing data the cron
          jobs and on-demand syncs keep fresh. No integration API calls. */}
      <AutoRefresh intervalMs={45_000} />

      {/* Setup wizard overlay — floats above dashboard, dismissed via localStorage */}
      <SetupWizardGate shouldShow={showFirstRun} steps={wizardSteps} />

      <SetupBanner forceShow={forceShowSetup} />

      {accessDenied ? <PropertyAccessDeniedBanner /> : null}

      {/* Insights hero — the centerpiece. Renders top 3 open insights when
          the org has data; falls back to a connect-data CTA when the org
          is brand-new. Pinned above the property selector + KPI strip so
          it's the first thing the operator sees on every dashboard load. */}
      <InsightsHero
        insights={openInsights as InsightCardData[]}
        counts={{
          critical: insightCounts.critical,
          warning: insightCounts.warning,
          info: insightCounts.info,
          total: insightCounts.total,
        }}
        sourcesConnected={connectStatus.connected}
        totalSources={connectStatus.total}
      />

      {/* Property selector — David can narrow the portfolio dashboard
          to one or more buildings. Direct-prisma KPI queries (counts,
          rent roll, residents, work orders, leases) honor the
          selection. Helper-backed widgets (lead source, funnel, ad
          spend, organic) currently remain org-wide; a "showing all
          properties" caption flags those tiles. */}
      {selectorProperties.length > 1 ? (
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <div className="text-xs text-muted-foreground">
            {isFiltered
              ? `Filtered to ${effectiveIds!.length} ${effectiveIds!.length === 1 ? "property" : "properties"}`
              : `Showing all ${selectorProperties.length} properties`}
          </div>
          <PropertyMultiSelect
            properties={selectorProperties}
            orgId={scope.orgId}
          />
        </div>
      ) : null}

      {/* Removed three legacy alert banners (past-due leases, urgent work
          orders, unreviewed reputation) and the IntegrationHealth chip
          row. Past-due / urgent / unreviewed conditions now surface as
          ranked insights inside <InsightsHero /> via the new detector
          library; integration health lives on /portal/connect, pinned
          to the sidebar Overview group. The dashboard should feel calm,
          not like a wall of competing CTAs. */}

      {/* Quick access — pinned to the top so the demo path is one click
          away. Trimmed to demo-confident modules only. Tiles that depend
          on AppFolio are hidden when the integration is off (the
          "Connect AppFolio" CTA further down handles that case). */}
      {/* Quick access — trimmed to 5 most-used modules. Anything an
          operator hits less than weekly belongs in the sidebar nav,
          not as a pinned tile. Removes ~10 of the previous 10-tile
          grid (was a wall of competing icons). */}
      <DashboardSection
        eyebrow="Jump in"
        title="Quick access"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <QuickAccessTile
            href="/portal/leads"
            label="Leads"
            icon={<Users className="h-4 w-4" />}
            meta={`${leadsNew28d.toLocaleString()} in 28d`}
          />
          {orgModules?.modulePixel ? (
            <QuickAccessTile
              href="/portal/visitors"
              label="Visitors"
              icon={<Flame className="h-4 w-4" />}
              meta={
                hotVisitors.count > 0
                  ? `${hotVisitors.count} hot now`
                  : "Pixel feed"
              }
            />
          ) : null}
          <QuickAccessTile
            href="/portal/tours"
            label="Tours"
            icon={<CalendarCheck className="h-4 w-4" />}
            meta={
              toursScheduled > 0
                ? `${toursScheduled} scheduled`
                : "Calendar"
            }
          />
          <QuickAccessTile
            href="/portal/reputation"
            label="Reputation"
            icon={<Star className="h-4 w-4" />}
            meta={
              reputationSummary.totalMentions > 0
                ? `${reputationSummary.totalMentions} mentions`
                : "Reviews + mentions"
            }
          />
          {!appfolioOff ? (
            <QuickAccessTile
              href="/portal/renewals"
              label="Renewals"
              icon={<CalendarClock className="h-4 w-4" />}
              meta={
                leasesExpiring120dCount > 0
                  ? `${leasesExpiring120dCount} expiring`
                  : "Lease pipeline"
              }
            />
          ) : (
            <QuickAccessTile
              href="/portal/connect"
              label="Connect"
              icon={<Sparkles className="h-4 w-4" />}
              meta="More data sources"
            />
          )}
        </div>
      </DashboardSection>

      {/* Insights now live in <InsightsHero /> at the top of the dashboard
          (above the property selector). Removed the duplicated mid-page
          strip so insights have a single, prominent surface. */}

      {/* At-a-glance KPI strip — TRIMMED to 4 daily-decision metrics.
          Was 8 tiles + 6-tile AppFolio mirror + 4-tile portfolio summary
          (= 18 raw numbers competing for attention). Now: leads, ad
          spend, organic, occupancy. Everything else lives on its
          subpage where the operator goes when they actually need detail. */}
      <section
        aria-label="At a glance"
        className="grid grid-cols-2 md:grid-cols-4 gap-2 ls-stagger"
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
          label="Ad spend (28d)"
          value={`$${adSpend.spendUsd.toLocaleString()}`}
          hint={
            costPerLeadDisplay !== "—"
              ? `${costPerLeadDisplay} per lead`
              : "Blended Google + Meta"
          }
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
          locked={
            adsOff
              ? {
                  reason: "Requires Google Ads or Meta",
                  href: "/portal/connect",
                }
              : undefined
          }
        />
        <KpiTile
          label="Organic"
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
          locked={
            organicOff
              ? { reason: "Requires GSC or GA4", href: "/portal/connect" }
              : undefined
          }
        />
        <KpiTile
          label="Occupancy"
          value={
            portfolioOccupancyPct != null
              ? `${portfolioOccupancyPct}%`
              : "—"
          }
          hint={
            portfolioTotalUnits > 0
              ? `${(portfolioTotalUnits - portfolioAvailableUnits).toLocaleString()} of ${portfolioTotalUnits.toLocaleString()} occupied`
              : "Connect AppFolio"
          }
          icon={<Building2 className="h-3.5 w-3.5" />}
          href="/portal/properties"
          locked={
            appfolioOff && portfolioTotalUnits === 0
              ? { reason: "Requires AppFolio", href: "/portal/connect" }
              : undefined
          }
        />
      </section>

      {/* Removed seven sections that previously rendered between the KPI
          strip and the properties table:
            - Performance row (lead source donut + conversion funnel)
            - Leasing velocity chart
            - Recent identified visitors
            - Reputation pulse
            - AppFolio not-connected hint
            - AppFolio mirror strip (6 KPIs)
            - Portfolio summary strip (4 KPIs)
          Each one duplicates data that lives on its own dedicated
          subpage (/portal/leads, /portal/visitors, /portal/reputation,
          /portal/renewals, etc.). The dashboard's job is to show
          insights + at-a-glance metrics + property table — not to be
          the catch-all for every chart in the platform. */}

          {/* Properties + activity feed */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-2">
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
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  {/* Header strip — small caps, only visible on lg where
                      every column actually renders. Mobile collapses to
                      avatar/name/address/leads automatically. */}
                  <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 border-b border-border bg-muted/30 text-[9px] tracking-widest uppercase font-semibold text-muted-foreground">
                    <div className="w-10 shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">Property</div>
                    <div className="w-[120px] shrink-0 text-right">
                      Occupancy
                    </div>
                    <div className="w-[68px] shrink-0 text-right">Units</div>
                    <div className="w-[68px] shrink-0 text-right">Ads</div>
                    <div className="w-[68px] shrink-0 text-right">Reviews</div>
                    <div className="w-[72px] shrink-0 text-right">
                      Leads (28d)
                    </div>
                    <div className="w-4 shrink-0" aria-hidden="true" />
                  </div>
                  <div className="divide-y divide-border">
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
                          totalUnits={p.totalUnits ?? null}
                          availableCount={p.availableCount ?? null}
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
                </div>
              )}
            </DashboardSection>

            <DashboardSection
              eyebrow="Recent"
              title="Activity feed"
              description="Latest events from leads, tours, ads, and your chatbot. Refresh the page to see new items."
              href="/portal/leads"
              hrefLabel="Open leads"
              className="lg:col-span-1"
            >
              <ActivityFeed items={activity} />
            </DashboardSection>
          </section>

    </div>
  );
  } catch (err) {
    console.error("[PortalHome] Failed to load dashboard data:", err);
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
          Dashboard data could not be loaded. This is usually temporary — try refreshing. If the issue persists, check{" "}
          <a href="/portal/settings/integrations" className="underline font-medium text-primary">
            Settings → Integrations
          </a>
          .
        </div>
      </div>
    );
  }
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
  // Badge tone is intentionally a single brand-blue treatment now —
  // the old "rose" amber variant fragmented the dashboard with a
  // second status colour.
  const badgeClass = "bg-primary/10 text-primary";
  void badgeTone;
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
