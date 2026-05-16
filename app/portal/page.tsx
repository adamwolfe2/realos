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
  ProductLine,
  TourStatus,
} from "@prisma/client";
import { SetupBanner } from "@/components/portal/setup/setup-banner";
import { SetupWizardGate } from "@/components/portal/onboarding/setup-wizard-gate";
import { AutoRefresh } from "@/components/portal/sync/auto-refresh";

import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { LeadSourceDonut } from "@/components/portal/dashboard/lead-source-donut";
import { ConversionFunnel } from "@/components/portal/dashboard/conversion-funnel";
import { PropertyDashboardCard } from "@/components/portal/dashboard/property-card";
import { PropertyGridCard } from "@/components/portal/dashboard/property-grid-card";
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
  getPerformanceOverTime,
  getPropertyMetrics,
  getRecentIdentifiedVisitors,
  getReputationPulse,
  getReputationSummary,
  getChatbotSummary,
  getTopPropertiesByLeads,
  type PerformancePoint,
  type LeaderboardPropertyRow,
} from "@/lib/dashboard/queries";
import {
  DashboardGreeting,
  parseRange,
  rangeDays,
} from "@/components/portal/dashboard/dashboard-greeting";
import { PerformanceOverTime } from "@/components/portal/dashboard/performance-over-time";
import { TopPropertiesLeaderboard } from "@/components/portal/dashboard/top-properties-leaderboard";
import { LeasingVelocityChart } from "@/components/portal/dashboard/leasing-velocity-chart";
import { RecentIdentifiedVisitors } from "@/components/portal/dashboard/recent-identified-visitors";
import { ReputationPulse } from "@/components/portal/dashboard/reputation-pulse";
import { getOpenInsights, getInsightCounts } from "@/lib/insights/queries";
import { InsightCard, type InsightCardData } from "@/components/portal/insights/insight-card";
import { InsightsHero } from "@/components/portal/dashboard/insights-hero";
import { countConnectedSources } from "@/lib/connect/status";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";

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
    range?: string;
    compare?: string;
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

  // Greeting + chart controls. Range pills (7d / 28d / 90d) and the
  // comparison toggle live in URL params so deep links and back/forward
  // nav work without any client state. parseRange clamps a bad value
  // to the default 28d instead of throwing.
  const range = parseRange(sp.range);
  const compare = sp.compare === "1";
  const rangeDaysCount = rangeDays(range);
  const asOf = new Date().toISOString();

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
    currentUser,
    performancePoints,
    topPropertiesByLeads,
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
        // Image hierarchy on the leaderboard avatar:
        //   1. heroImageUrl (operator-curated marketing hero, or scraped og:image)
        //   2. first entry of photoUrls (AppFolio-synced listing photos)
        //   3. logoUrl alone (scraped brand mark, no hero photo yet)
        //   4. Building icon fallback (rendered by PropertyAvatar)
        // The logo also overlays the hero as a small badge when both
        // are present — feels distinctly premium next to a competitor's
        // bare letter monogram.
        heroImageUrl: true,
        photoUrls: true,
        logoUrl: true,
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
    // AppFolio mirror metrics (rent roll, residents, leases, work
    // orders) intentionally removed from the dashboard. LeaseStack is
    // positioned as a marketing intelligence platform, not a PMS
    // competitor. The 9 dead queries that lived here pulled from
    // AppFolio endpoints that fail independently (guest_cards 404,
    // residents permission errors, etc.) and produced noise the
    // dashboard no longer rendered anyway. When the Operations module
    // ships as a hardened, opt-in feature, these queries move into a
    // dedicated helper guarded by `enableOperations`.
    // Current user — drives the personalized greeting in the header.
    prisma.user
      .findUnique({
        where: { id: scope.userId },
        select: { firstName: true, lastName: true, email: true },
      })
      .catch(() => null),
    // Lead velocity over the selected window with optional prior-period
    // overlay. Powers the headline interactive chart.
    getPerformanceOverTime(scope.orgId, rangeDaysCount, compare).catch(
      () => [] as PerformancePoint[],
    ),
    // Top 5 properties by lead count in the selected window. Drives the
    // URBN-style leaderboard panel.
    getTopPropertiesByLeads(
      scope.orgId,
      rangeDaysCount,
      5,
      isFiltered ? effectiveIds : null,
    ).catch(() => [] as LeaderboardPropertyRow[]),
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

      {/* Personalized greeting with range pills + comparison toggle.
          Sits above InsightsHero so the operator sees their name + the
          active window the moment the page loads — every reference
          dashboard (AeroStore, URBN, Emura, Mori) opens this way. */}
      <DashboardGreeting
        firstName={currentUser?.firstName ?? null}
        orgName={org?.name ?? "operator"}
        range={range}
        compare={compare}
        asOf={asOf}
      />

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
          {/* Caption pre-fix read as flat muted text; the new treatment
              uses a small dot + tracking so it reads as intentional page
              chrome rather than a system message. */}
          <div className="inline-flex items-center gap-1.5 text-[11px] tracking-wide text-muted-foreground">
            <span
              aria-hidden="true"
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isFiltered ? "bg-primary" : "bg-muted-foreground/40"
              }`}
            />
            {isFiltered
              ? `Filtered to ${effectiveIds!.length} of ${selectorProperties.length} ${effectiveIds!.length === 1 ? "property" : "properties"}`
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

      {/* Removed the "Quick access — Jump in" tile section. Per design
          audit, those tiles duplicated entries already in the left nav
          and added a wall of competing CTAs above the KPI strip. The
          QuickAccessTile component remains in this file (used nowhere
          else now) but is left in place rather than ripped out so the
          rollback is a one-liner. */}

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
          variant="accent"
          label="Total leads"
          value={leadsNew28d.toLocaleString()}
          hint={`${leadsTotal.toLocaleString()} all-time`}
          spark={totalLeadsSpark}
          chart="bars"
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
          gaugeValue={
            portfolioOccupancyPct != null
              ? portfolioOccupancyPct / 100
              : undefined
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

      {/* Headline interactive chart + top-properties leaderboard. The
          chart is the centerpiece — soft blue area chart with optional
          prior-period overlay (matches the AeroStore reference pattern)
          — and the leaderboard ranks properties by lead volume in the
          same window so the operator can drill from "are we trending
          up" to "which buildings are carrying the trend." Both react
          to the range pills + compare toggle in the header. */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-2">
        <DashboardSection
          eyebrow={
            compare ? "Current vs prior period" : "Daily volume"
          }
          title="Lead performance over time"
          description={`Leads created per day, last ${rangeDaysCount} days. Hover any point for the exact count.`}
          href="/portal/leads"
          hrefLabel="Open leads"
          className="lg:col-span-3"
        >
          <PerformanceOverTime
            points={performancePoints}
            compare={compare}
          />
        </DashboardSection>
        <DashboardSection
          eyebrow="Portfolio leaderboard"
          title="Top properties"
          description={`Ranked by leads in the last ${rangeDaysCount} days.`}
          href="/portal/properties"
          hrefLabel="See all"
          className="lg:col-span-2"
        >
          <TopPropertiesLeaderboard rows={topPropertiesByLeads} />
        </DashboardSection>
      </section>

      {/* Performance row — Restored after operator feedback that the
          portal lacked the same at-a-glance visualization shown on the
          /sign-in marketing showcase. The conversion funnel + lead
          source donut deliver the "marketing → leasing" story in one
          glance, and both pull from queries we were already running
          (getFunnel, getLeadSourceBreakdown). Detailed drill-downs
          still live on /portal/leads, /portal/visitors, etc.; this
          surface is the summary header that motivates the click. */}
      {(funnelStages.length > 0 || leadSourceSlices.length > 0) ? (
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-2">
          <DashboardSection
            eyebrow="Last 28 days"
            title="Conversion funnel"
            description="Visitors → leads → tours → applications → leases."
            href="/portal/leads"
            hrefLabel="Open leads"
            className="lg:col-span-3"
          >
            {funnelStages.length > 0 ? (
              <ConversionFunnel stages={funnelStages} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Funnel fills out as visitors, leads, tours, and applications
                accumulate. Install the pixel and connect AppFolio to start
                tracking end-to-end.
              </p>
            )}
          </DashboardSection>
          <DashboardSection
            eyebrow="Channel mix"
            title="Lead source"
            description="Where this month's leads are coming from."
            href="/portal/attribution"
            hrefLabel="Open attribution"
            className="lg:col-span-2"
          >
            <LeadSourceDonut slices={leadSourceSlices} />
          </DashboardSection>
        </section>
      ) : null}

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Replaced the dense Linear-style table rows with
                      AeroStore-style image-led grid cards. Each property
                      is immediately identifiable by its hero photo —
                      critical for operators managing 4-8 buildings where
                      "Sunset Commons" and "Maple Ridge" are visually
                      indistinguishable in a plain text list. */}
                  {/* Placeholder div — column header was here in list mode;
                      grid cards carry their own labels so this is gone. */}
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
                      const photoFallback = (() => {
                        const arr = p.photoUrls;
                        if (Array.isArray(arr) && arr.length > 0) {
                          const first = arr[0];
                          return typeof first === "string" && first.length > 0
                            ? first
                            : null;
                        }
                        return null;
                      })();
                      const avatarUrl = p.heroImageUrl ?? photoFallback;
                      return (
                        <PropertyGridCard
                          key={p.id}
                          id={p.id}
                          name={p.name}
                          address={address || null}
                          thumbnailUrl={avatarUrl}
                          occupancyPct={occupancyPct}
                          totalUnits={p.totalUnits ?? null}
                          availableCount={p.availableCount ?? null}
                          leads28d={metrics.leads28d}
                          leadsSpark={metrics.leadsSpark}
                          activeCampaigns={metrics.activeCampaigns}
                          accent={org?.primaryColor ?? undefined}
                          reputationMentionCount={metrics.reputationMentionCount}
                          reputationUnreviewedCount={metrics.reputationUnreviewedCount}
                        />
                      );
                    })}
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

          {/* Operations module teaser — collects interest from operators
              who want rent roll, renewal notices, and rental income
              reconciliation. Currently a "coming soon" card rather than
              a live module: the AppFolio integration is not yet
              hardened enough (per-endpoint failures, no stale-data UX,
              no retry/backoff) to render those numbers reliably on a
              tenant-facing surface. When `enableOperations` ships on
              Organization, this card flips into the full Operations
              section. */}
          <section className="rounded-2xl border border-border bg-gradient-to-br from-card to-primary/[0.03] p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
                    Coming soon
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Operations module
                  </span>
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground leading-tight">
                  Rent roll, renewals, and rental income in one place.
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  We&apos;re hardening the AppFolio sync to surface live rent
                  rolls, renewal pacing, resident notices, and payment
                  reconciliation alongside your marketing data. Connect
                  AppFolio today and you&apos;ll be first in line when it
                  ships.
                </p>
              </div>
              <div className="shrink-0">
                <Link
                  href="/portal/connect"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3.5 py-2 text-xs font-semibold hover:bg-primary-dark transition-colors"
                >
                  Connect AppFolio
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </section>

    </div>
  );
  } catch (err) {
    console.error("[PortalHome] Failed to load dashboard data:", err);
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" />
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
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
      className="group relative flex items-center gap-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/40 hover:shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-all px-3 py-2.5 min-w-0"
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
