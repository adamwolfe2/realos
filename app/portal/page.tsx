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
    // The number here must match what the operator sees in the
    // /portal/properties list and the sidebar.
    prisma.property.count({ where: marketablePropertyWhere(scope.orgId) }),
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
        where: { ...where, status: LeaseStatus.ACTIVE },
        _sum: { monthlyRentCents: true },
      })
      .catch(() => ({ _sum: { monthlyRentCents: 0 } })),
    prisma.resident
      .count({ where: { ...where, status: ResidentStatus.ACTIVE } })
      .catch(() => 0),
    prisma.resident
      .count({ where: { ...where, status: ResidentStatus.NOTICE_GIVEN } })
      .catch(() => 0),
    prisma.lease
      .count({
        where: {
          ...where,
          status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
          endDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 120 * DAY),
          },
        },
      })
      .catch(() => 0),
    prisma.lease.count({ where: { ...where, isPastDue: true } }).catch(() => 0),
    prisma.lease
      .aggregate({
        where: { ...where, isPastDue: true },
        _sum: { currentBalanceCents: true },
      })
      .catch(() => ({ _sum: { currentBalanceCents: 0 } })),
    prisma.workOrder
      .count({
        where: {
          ...where,
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

  return (
    <div className="space-y-2 ls-page-fade">
      {/* Auto-refresh dashboard data every 45s. Cheap — just re-runs the
          server-component Prisma queries against existing data the cron
          jobs and on-demand syncs keep fresh. No integration API calls. */}
      <AutoRefresh intervalMs={45_000} />

      {/* Setup wizard overlay — floats above dashboard, dismissed via localStorage */}
      <SetupWizardGate shouldShow={showFirstRun} steps={wizardSteps} />

      <SetupBanner forceShow={forceShowSetup} />

      {/* Past-due lease alert — surfaces from AppFolio delinquency. Operator
          should already see this in AppFolio, but the dashboard makes it
          impossible to miss before they open the other tab. */}
      {pastDueLeasesCount > 0 ? (
        <Link
          href="/portal/renewals"
          className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 hover:bg-amber-100 transition-colors group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-900 truncate">
                {pastDueLeasesCount.toLocaleString()} past-due
                {" "}
                {pastDueLeasesCount === 1 ? "lease" : "leases"}
                {pastDueDisplay ? ` · ${pastDueDisplay} owed` : ""}
              </p>
              <p className="text-[11px] text-amber-800">
                From AppFolio delinquency report. Open Renewals to review.
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-amber-900 group-hover:text-amber-950 whitespace-nowrap">
            Review →
          </span>
        </Link>
      ) : null}

      {/* Urgent open work-order alert. Don't surface unless we've actually
          synced any work orders (avoids empty noise on first install). */}
      {urgentWorkOrdersCount > 0 ? (
        <Link
          href="/portal/work-orders"
          className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 hover:bg-amber-100 transition-colors group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Wrench className="h-4 w-4 text-amber-700 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-900 truncate">
                {urgentWorkOrdersCount.toLocaleString()} urgent work
                {" "}
                {urgentWorkOrdersCount === 1 ? "order" : "orders"} open
              </p>
              <p className="text-[11px] text-amber-800">
                Stop-the-bleed maintenance tickets. Source of truth: AppFolio.
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-amber-900 group-hover:text-amber-950 whitespace-nowrap">
            Review →
          </span>
        </Link>
      ) : null}

      {/* Unreviewed reputation alert — surfaces buried action items.
          Reputation Scanner used to be hidden in property detail tabs. This
          banner makes it impossible to miss when there's something to act on. */}
      {reputationSummary.unreviewedCount > 0 ? (
        <Link
          href="/portal/reputation"
          className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 hover:bg-amber-100 transition-colors group"
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

      {/* Quick access — pinned to the top so the demo path is one click
          away. Trimmed to demo-confident modules only. Tiles that depend
          on AppFolio are hidden when the integration is off (the
          "Connect AppFolio" CTA further down handles that case). */}
      <DashboardSection
        eyebrow="One click away"
        title="Quick access"
        description="Jump straight to any module from the dashboard"
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
          <QuickAccessTile
            href="/portal/leads"
            label="Leads"
            icon={<Users className="h-4 w-4" />}
            meta={`${leadsNew28d.toLocaleString()} in 28d`}
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
              applicationsAwaitingReview > 0 ? applicationsAwaitingReview : null
            }
            badgeTone={applicationsAwaitingReview > 0 ? "rose" : undefined}
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
            href="/portal/reputation"
            label="Reputation"
            icon={<Star className="h-4 w-4" />}
            meta={
              reputationSummary.totalMentions > 0
                ? `${reputationSummary.totalMentions} mentions`
                : "Reviews + mentions"
            }
            badge={
              reputationSummary.unreviewedCount > 0
                ? reputationSummary.unreviewedCount
                : null
            }
          />
          {!appfolioOff ? (
            <>
              <QuickAccessTile
                href="/portal/residents"
                label="Residents"
                icon={<Home className="h-4 w-4" />}
                meta={
                  activeResidentsCount > 0
                    ? `${activeResidentsCount} active`
                    : "AppFolio mirror"
                }
                badge={noticeGivenCount > 0 ? noticeGivenCount : null}
              />
              <QuickAccessTile
                href="/portal/renewals"
                label="Renewals"
                icon={<CalendarClock className="h-4 w-4" />}
                meta={
                  leasesExpiring120dCount > 0
                    ? `${leasesExpiring120dCount} expiring`
                    : "Lease pipeline"
                }
                badge={pastDueLeasesCount > 0 ? pastDueLeasesCount : null}
                badgeTone={pastDueLeasesCount > 0 ? "rose" : undefined}
              />
              <QuickAccessTile
                href="/portal/work-orders"
                label="Work orders"
                icon={<Wrench className="h-4 w-4" />}
                meta={
                  openWorkOrdersCount > 0
                    ? `${openWorkOrdersCount} open`
                    : "Maintenance"
                }
                badge={
                  urgentWorkOrdersCount > 0 ? urgentWorkOrdersCount : null
                }
                badgeTone={urgentWorkOrdersCount > 0 ? "rose" : undefined}
              />
            </>
          ) : null}
          {orgModules?.moduleChatbot ? (
            <QuickAccessTile
              href="/portal/conversations"
              label="Conversations"
              icon={<MessageSquare className="h-4 w-4" />}
              meta={`${chatbotSummary.conversations28d} in 28d`}
            />
          ) : null}
          {orgModules?.moduleGoogleAds || orgModules?.moduleMetaAds ? (
            <QuickAccessTile
              href="/portal/campaigns"
              label="Campaigns"
              icon={<Megaphone className="h-4 w-4" />}
              meta={`$${adSpend.spendUsd.toLocaleString()} spend`}
            />
          ) : null}
        </div>
      </DashboardSection>

      {/* Insights strip — opens the day with what changed, if anything */}
      {insightCounts.total > 0 ? (
        <section className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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

      {/* KPI strip — four tiles per row, two rows at desktop. Labels are
          readable at this width and values don't overflow. */}
      <section
        aria-label="Key metrics"
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
              label="Hot visitors"
              value={hotVisitors.count.toLocaleString()}
              hint="Active in the last 5 minutes"
              spark={hotVisitors.sparkline}
              icon={<Flame className="h-3.5 w-3.5" />}
              live
              href="/portal/visitors"
              locked={cursiveOff ? { reason: "Requires pixel", href: "/portal/settings/integrations" } : undefined}
            />
            <KpiTile
              label="Tours"
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
              locked={organicOff ? { reason: "Requires GSC or GA4", href: "/portal/settings/integrations" } : undefined}
            />
            <KpiTile
              label="Google rating"
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
              label="Chatbot"
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
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-2">
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

          {/* AppFolio not-connected hint — the mirror strip below hides
              itself when there's no data, but that creates a silent
              absence. This banner explains why the operations metrics are
              missing and gives a one-click setup CTA. */}
          {appfolioOff &&
          rentRollMonthly === 0 &&
          activeResidentsCount === 0 &&
          openWorkOrdersCount === 0 ? (
            <Link
              href="/portal/settings/integrations"
              className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 hover:border-foreground/40 transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    Connect AppFolio to unlock the operations dashboard
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Mirror residents, leases, work orders, and rent roll
                    here — without leaving AppFolio as your source of
                    truth.
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium text-foreground group-hover:underline whitespace-nowrap">
                Connect →
              </span>
            </Link>
          ) : null}

          {/* AppFolio mirror strip — rent roll, residents, renewals, work
              orders. AppFolio remains source of truth; we surface the
              numbers so operators don't have to leave the dashboard. */}
          {(rentRollMonthly > 0 ||
            activeResidentsCount > 0 ||
            openWorkOrdersCount > 0) ? (
            <section
              aria-label="AppFolio mirror"
              className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2"
            >
              <KpiTile
                label="Monthly rent roll"
                value={rentRollMonthlyDisplay}
                hint={`From ${activeResidentsCount.toLocaleString()} active leases`}
                icon={<DollarSign className="h-3.5 w-3.5" />}
                href="/portal/renewals"
              />
              <KpiTile
                label="Active residents"
                value={activeResidentsCount.toLocaleString()}
                hint="Mirrored from AppFolio"
                icon={<Home className="h-3.5 w-3.5" />}
                href="/portal/residents"
              />
              <KpiTile
                label="Notice given"
                value={noticeGivenCount.toLocaleString()}
                hint="Coming open soon"
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                href="/portal/residents?status=NOTICE_GIVEN"
              />
              <KpiTile
                label="Expiring (120d)"
                value={leasesExpiring120dCount.toLocaleString()}
                hint="Need renewal action"
                icon={<CalendarClock className="h-3.5 w-3.5" />}
                href="/portal/renewals"
              />
              <KpiTile
                label="Open work orders"
                value={openWorkOrdersCount.toLocaleString()}
                hint={
                  urgentWorkOrdersCount > 0
                    ? `${urgentWorkOrdersCount} urgent`
                    : "Maintenance queue"
                }
                icon={<Wrench className="h-3.5 w-3.5" />}
                href="/portal/work-orders"
                delta={
                  urgentWorkOrdersCount > 0
                    ? { value: `${urgentWorkOrdersCount} urgent`, trend: "down" }
                    : undefined
                }
              />
              <KpiTile
                label="Past-due leases"
                value={pastDueLeasesCount.toLocaleString()}
                hint={pastDueDisplay ? `${pastDueDisplay} owed` : "All current"}
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                href="/portal/renewals"
              />
            </section>
          ) : null}

          {/* Portfolio summary strip — occupancy + total units + active
              campaigns. Sized between KPIs and property cards so it visually
              ties them together. */}
          {portfolioTotalUnits > 0 ? (
            <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Dashboard data could not be loaded. This is usually temporary — try refreshing. If the issue persists, check{" "}
          <a href="/portal/settings/integrations" className="underline font-medium">
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
  const badgeClass =
    badgeTone === "rose"
      ? "bg-amber-100 text-amber-700"
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
