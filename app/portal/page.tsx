import type { Metadata } from "next";
import {
  Users,
  CalendarCheck,
  DollarSign,
  Search,
  Building2,
  ArrowRight,
} from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import {
  marketablePropertyWhere,
  withMarketableLifecycle,
} from "@/lib/properties/marketable";
import {
  effectivePropertyIds,
  isAccessDenied,
  marketableScopedPropertyClause,
  parsePropertyFilter,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import {
  ApplicationStatus,
  OnboardingPhase,
  ProductLine,
  TourStatus,
} from "@prisma/client";
import { AutoRefresh } from "@/components/portal/sync/auto-refresh";

import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { LeadSourceDonut } from "@/components/portal/dashboard/lead-source-donut";
import { ConversionFunnel } from "@/components/portal/dashboard/conversion-funnel";
import { ActivityFeed } from "@/components/portal/dashboard/activity-feed";
import {
  getActivityFeed,
  getAdSpendKpi,
  getFunnel,
  getHotVisitors,
  getIntegrationHealth,
  getLeadSourceBreakdown,
  getOrganicSessionsKpi,
  getPerformanceOverTime,
  getPortfolioLeadsSpark,
  getTopPropertiesByLeads,
  type PerformancePoint,
  type LeaderboardPropertyRow,
} from "@/lib/dashboard/queries";
import {
  RANGES,
  parseRange,
  rangeDays,
  type DashboardRange,
} from "@/lib/dashboard/range";
import { PerformanceOverTime } from "@/components/portal/dashboard/performance-over-time";
import { TopPropertiesLeaderboard } from "@/components/portal/dashboard/top-properties-leaderboard";
import { getOpenInsights, getInsightCounts } from "@/lib/insights/queries";
import {
  InsightCard,
  type InsightCardData,
} from "@/components/portal/insights/insight-card";
import { InsightsHero } from "@/components/portal/dashboard/insights-hero";
import { countConnectedSources } from "@/lib/connect/status";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { getFirstRunSignal } from "@/lib/portal/first-run";
import { WelcomeLanding } from "@/components/portal/welcome-landing";
import { syncOnboardingProgress } from "@/lib/onboarding/step-detectors";
import { OnboardingStepper } from "@/components/portal/onboarding/onboarding-stepper";
import { VerificationRow } from "@/components/portal/ui/status-chip";
import { PropertyHeroBanner } from "@/components/portal/properties/property-hero-banner";
import { DashboardActionItems } from "@/components/portal/dashboard/dashboard-action-items";
import { PortfolioSeoActions } from "@/components/portal/dashboard/portfolio-seo-actions";
import { getPortfolioRecommendations } from "@/lib/intelligence/property-recommendations";

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
    /** Escape hatch — pass ?dashboard=1 to force the operator dashboard
     *  even when the org would otherwise hit the first-run welcome
     *  landing. Useful for screenshots, demos, and the "I want to peek
     *  at the empty state" case. */
    dashboard?: string;
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
  const forceDashboard = sp.dashboard === "1";

  // Self-serve onboarding sync — lazily initialize progress on the first
  // /portal landing and re-run any detectors that are still PENDING. Skipped
  // once the operator has cleared POLISH (currentPhase=COMPLETED) so a long-
  // term operator never pays for the detector queries. Detectors are
  // wrapped to never throw — a failure here renders the dashboard with the
  // checklist absent rather than 500ing the whole page.
  const onboardingProgress = await syncOnboardingProgress(scope.orgId).catch(
    (err) => {
      console.warn("[portal/page] onboarding sync failed:", err);
      return null;
    },
  );
  const showChecklist =
    !!onboardingProgress &&
    onboardingProgress.currentPhase !== OnboardingPhase.COMPLETED;

  // First-run gate. Brand-new orgs with zero modules activated, zero leads,
  // and zero connected data sources see a Marketplace landing instead of
  // the empty dashboard. As soon as ANY of those signals flips non-zero,
  // they fall through to the normal dashboard automatically — no separate
  // "onboarded" flag to drift out of sync. Agency users impersonating a
  // brand-new client hit the same surface because scope.orgId already
  // resolves to the impersonated org.
  if (!forceDashboard) {
    const firstRun = await getFirstRunSignal(scope.orgId).catch(() => null);
    if (firstRun?.isFirstRun) {
      const org = await prisma.organization
        .findUnique({
          where: { id: scope.orgId },
          select: {
            name: true,
            slug: true,
            subscriptionStatus: true,
            trialEndsAt: true,
          },
        })
        .catch(() => null);
      const isTrialing =
        !org?.subscriptionStatus || org.subscriptionStatus === "TRIALING";
      const trialDaysLeft = org?.trialEndsAt
        ? Math.max(
            0,
            Math.ceil(
              (new Date(org.trialEndsAt).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : null;
      // Platform domain — same priority order as the runtime resolver
      // in lib/tenancy/resolve.ts so the displayed URL matches what
      // the middleware actually serves.
      const platformDomain =
        process.env.PLATFORM_DOMAIN ??
        process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ??
        (process.env.NEXT_PUBLIC_APP_URL
          ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname.replace(
              /^www\./,
              "",
            )
          : null);
      return (
        <WelcomeLanding
          orgName={org?.name ?? "your workspace"}
          orgSlug={org?.slug ?? null}
          platformDomain={platformDomain}
          isTrialing={isTrialing}
          trialDaysLeft={trialDaysLeft}
          isImpersonating={scope.isImpersonating}
        />
      );
    }
  }

  // Greeting + chart controls. Range pills (7d / 28d / 90d) and the
  // comparison toggle live in URL params so deep links and back/forward
  // nav work without any client state. parseRange clamps a bad value
  // to the default 28d instead of throwing.
  const range = parseRange(sp.range);
  const compare = sp.compare === "1";
  const rangeDaysCount = rangeDays(range);
  const asOf = new Date().toISOString();
  // Human "as of" time for the PageHeader meta pill. Pacific — matches the
  // #58 / #109 timezone convention for operator-facing timestamps.
  const asOfLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(asOf));

  // Property selector (Phase 4): unrestricted users (David, agency)
  // can narrow the dashboard to one or more properties via the
  // multi-select dropdown at the top. Direct-prisma KPI queries
  // honor the filter; helper functions that don't yet accept
  // propertyIds remain org-wide and are flagged in the UI.
  // Pass scope.orgId so a stale ACTIVE_PROPERTY_COOKIE pointing at an
  // EXCLUDED / IMPORTED / ARCHIVED property gets validated + cleared
  // instead of silently scoping every KPI to zero. Root cause of the
  // SG Real Estate "dashboard is empty" report (2026-06-03).
  const requestedIds = await parsePropertyFilter(sp, scope.orgId);
  const accessDenied = isAccessDenied(scope, requestedIds);
  const effectiveIds = effectivePropertyIds(scope, requestedIds);
  // Default (no selection) scopes KPIs to enabled properties; org-level
  // rows (null propertyId on nullable models) stay visible.
  const propertyClause = await marketableScopedPropertyClause(
    scope,
    requestedIds,
    "propertyId",
    { defaultIncludesOrgRows: true },
  );
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
      openInsights,
      insightCounts,
      connectStatus,
      orgModules,
      currentUser,
      performancePoints,
      topPropertiesByLeads,
    ] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: scope.orgId },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          primaryColor: true,
        },
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
        // BUG fix (Norman 2026-05-21 screenshot): the "Top properties"
        // widget was using bare `tenantWhere(scope)` which includes
        // IMPORTED / EXCLUDED / ARCHIVED rows — so SG Real Estate's
        // dashboard surfaced uncurated AppFolio sub-records (2023
        // Channing Way, 1321 Spruce, etc.) even though the Properties
        // page (which uses `withMarketableLifecycle`) correctly shows
        // only Telegraph Commons. Now using the same gate as the
        // Properties page + the leaderboard helper.
        where: {
          ...withMarketableLifecycle(where),
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
      // P1-2: scope the dashboard insight card + counts to the user's gated
      // properties so a property-restricted user never sees other buildings'
      // insights (effectiveIds is the org-wide null only for unrestricted users).
      getOpenInsights(scope.orgId, { propertyIds: effectiveIds, limit: 3 }).catch(
        () => [],
      ),
      getInsightCounts(scope.orgId, { propertyIds: effectiveIds }).catch(() => ({
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

    // 28d leads sparkline, summed across the visible properties. Only the
    // spark shape is consumed on this page (see getPortfolioLeadsSpark) —
    // the full per-property leads/campaigns/reputation rollup from
    // getPropertyMetrics isn't rendered here.
    const totalLeadsSpark = await getPortfolioLeadsSpark(
      scope.orgId,
      properties.map((p) => p.id),
    );

    // Onboarding rollup — surfaces total properties still in ONBOARDING
    // beneath the leaderboard so an operator with a long tail (e.g. SG
    // launching with 120+ IMPORTED rows, 2 ACTIVE) sees one honest number
    // instead of staring at a top-5 list that doesn't represent the
    // portfolio yet. Cheap count, no per-row data.
    const propertiesInOnboarding = await prisma.property
      .count({
        where: {
          orgId: scope.orgId,
          launchStatus: "ONBOARDING",
          // Exclude auto-classified sub-records (parking, storage, etc.) that
          // AppFolio sync imports as EXCLUDED. Counting them made SG show
          // "133 in onboarding" when only the real marketable buildings matter.
          lifecycle: { not: "EXCLUDED" },
          ...(isFiltered ? { id: { in: effectiveIds! } } : {}),
        },
      })
      .catch(() => 0);

    // Realistic delta calc: % change vs previous 28d window. Suppress when the
    // prior window had fewer than 3 events — at n=1 the percentage is
    // statistically meaningless and renders as alarming noise ("+1000%").
    const LOW_SAMPLE_FLOOR = 3;
    const leadsDeltaPct =
      leadsPrev28d >= LOW_SAMPLE_FLOOR
        ? Math.round(((leadsNew28d - leadsPrev28d) / leadsPrev28d) * 100)
        : null;

    const toursDeltaPct =
      toursPrev28d >= LOW_SAMPLE_FLOOR
        ? Math.round(((toursScheduled - toursPrev28d) / toursPrev28d) * 100)
        : null;

    // Cost per lead. Show "—" when there are no leads in the window so the tile
    // doesn't render an infinity-shaped number.
    const costPerLead = leadsNew28d > 0 ? adSpend.spendUsd / leadsNew28d : null;
    const costPerLeadDisplay =
      costPerLead != null ? `$${costPerLead.toFixed(2)}` : "\u2014";

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
              100,
          )
        : null;

    const cursiveOff =
      integrationChips.find((c) => c.key === "cursive")?.status === "off";
    const appfolioChip = integrationChips.find((c) => c.key === "appfolio");
    const appfolioOff = appfolioChip?.status === "off";
    const appfolioDegraded = appfolioChip?.status === "degraded";
    // AppFolio integration row — used to surface "Auto-sync paused" as a
    // subtle chip on the dashboard Operations teaser. Cheap probe (a few
    // boolean fields) and only renders when the operator has connected
    // AppFolio but disabled the hourly cron.
    const appfolioRow = await prisma.appFolioIntegration
      .findUnique({
        where: { orgId: scope.orgId },
        select: { autoSyncEnabled: true, instanceSubdomain: true },
      })
      .catch(() => null);
    const appfolioConnected = !!appfolioRow?.instanceSubdomain;
    const appfolioAutoSyncPaused =
      appfolioConnected && appfolioRow?.autoSyncEnabled === false;
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
    const selectorProperties = visibleProperties(
      scope,
      allPropertiesForSelector,
    );

    // Featured property hero. Anchors the dashboard with a real building
    // before the action chrome. Selection rule:
    //   - Single LIVE property → that one.
    //   - Multiple LIVE properties → the one with the most SeoScoreHistory
    //     rows (rich data signal). Tiebreak: highest googleAggRating, then
    //     name asc. This puts an operator's best-tracked / highest-rated
    //     building front and centre on the demo without hard-coding any
    //     specific tenant.
    const liveProperties = await prisma.property
      .findMany({
        where: {
          orgId: scope.orgId,
          launchStatus: "LIVE",
          lifecycle: "ACTIVE",
          ...(isFiltered ? { id: { in: effectiveIds! } } : {}),
        },
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          heroImageUrl: true,
          heroImageOffsetX: true,
          heroImageOffsetY: true,
          heroImageScale: true,
          residentialSubtype: true,
          commercialSubtype: true,
          propertyType: true,
          totalUnits: true,
          googleAggRating: true,
          googleAggReviewCount: true,
        },
        take: 25,
      })
      .catch(() => []);

    let featuredProperty: (typeof liveProperties)[number] | null = null;
    if (liveProperties.length === 1) {
      featuredProperty = liveProperties[0];
    } else if (liveProperties.length > 1) {
      // Rank by score-history depth (proxy for "best-tracked property").
      const scoreCounts = await prisma.seoScoreHistory
        .groupBy({
          by: ["propertyId"],
          where: { propertyId: { in: liveProperties.map((p) => p.id) } },
          _count: { _all: true },
        })
        .catch(
          () =>
            [] as Array<{
              propertyId: string | null;
              _count: { _all: number };
            }>,
        );
      const countById = new Map<string, number>(
        scoreCounts
          .filter((s) => s.propertyId != null)
          .map((s) => [s.propertyId as string, s._count._all]),
      );
      const ranked = [...liveProperties].sort((a, b) => {
        const aCount = countById.get(a.id) ?? 0;
        const bCount = countById.get(b.id) ?? 0;
        if (aCount !== bCount) return bCount - aCount;
        const aRating = a.googleAggRating ?? 0;
        const bRating = b.googleAggRating ?? 0;
        if (aRating !== bRating) return bRating - aRating;
        return a.name.localeCompare(b.name);
      });
      featuredProperty = ranked[0] ?? null;
    }

    // Portfolio-wide intelligence — top 5 actionable recommendations
    // across every LIVE property. Surfaces as a "Action items" strip
    // below the greeting. Wrapped in catch so a slow rec query never
    // blocks the dashboard render.
    const portfolioActions = await getPortfolioRecommendations(scope.orgId, {
      limit: 5,
    }).catch(() => []);

    // Portfolio-wide SEO Agent recommendations. Sibling to portfolioActions,
    // but sourced from the SEO recommendation engine (richer per-query
    // signal). Reads from the SeoActionRecommendation table directly —
    // these rows are kept fresh by the manual refresh button + nightly
    // crons + the 1h Redis cache on the cached generator.
    const portfolioSeoActionsRaw = await prisma.seoActionRecommendation
      .findMany({
        where: {
          orgId: scope.orgId,
          status: "OPEN",
          property: {
            launchStatus: "LIVE",
            lifecycle: "ACTIVE",
          },
          ...(scope.allowedPropertyIds
            ? { propertyId: { in: scope.allowedPropertyIds } }
            : {}),
        },
        orderBy: [{ severity: "asc" }, { score: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          detail: true,
          severity: true,
          estimateMinutes: true,
          actionHref: true,
          actionLabel: true,
          category: true,
          propertyId: true,
          property: { select: { name: true } },
        },
      })
      .catch(() => []);
    const portfolioSeoActions = portfolioSeoActionsRaw.map((r) => ({
      id: r.id,
      title: r.title,
      detail: r.detail,
      severity: r.severity,
      estimateMinutes: r.estimateMinutes,
      actionHref: r.actionHref,
      actionLabel: r.actionLabel,
      category: r.category,
      propertyId: r.propertyId,
      propertyName: r.property?.name ?? null,
    }));

    let featuredStats: Array<{
      label: string;
      value: string;
      delta?: string;
      tone?: "positive" | "negative" | "neutral";
      // Per-tile click target + breakdown hint. Mirrors the Stat shape
      // in components/portal/properties/property-hero-banner.tsx so the
      // operator can click a number to land on the page that actually
      // backs it (Norman feedback May 22).
      href?: string;
      hint?: string;
    }> = [];
    if (featuredProperty) {
      const featNow = new Date();
      const featThirty = new Date(featNow.getTime() - 30 * 24 * 60 * 60 * 1000);
      const featSixty = new Date(featNow.getTime() - 60 * 24 * 60 * 60 * 1000);
      // Norman feedback (May 22): "3 LEADS · 30D" looked terrible — that's
      // just the Lead table (form/chatbot opt-ins). Real captured-contact
      // surface is much bigger. Aggregate every signal we have so the
      // hero reads as the actual marketing surface area:
      //
      //   Lead rows                — form / chatbot opt-ins
      // + Identified visitors      — visitor pixel resolved to a real
      //                              person; the visitor feed lives here.
      //                              For single-property orgs (like TC)
      //                              pixel visitors aren't always
      //                              property-tagged, so fall back to
      //                              org-wide when the property has its
      //                              own pixel + no per-property attr.
      // + Chatbot conversations    — people who started a conversation
      //                              even if they didn't drop email
      // + Tours scheduled          — calendar bookings
      // + Applications submitted   — AppFolio guest_cards / online
      //                              applications (gated on the
      //                              integration being healthy)
      // + Active leases            — closed-loop pipeline floor
      //
      // Each subtotal is shown alongside the headline so it reads as a
      // breakdown, not a single opaque number.
      const [
        fLeadsCur,
        fLeadsPrior,
        fConvosCur,
        fConvosPrior,
        fIdentVisCur,
        fIdentVisPrior,
        fIdentVisOrgWideCur,
        fIdentVisOrgWidePrior,
        fToursCur,
        fAppsCur,
        fActiveLeases,
      ] = await Promise.all([
        prisma.lead
          .count({
            where: {
              orgId: scope.orgId,
              propertyId: featuredProperty.id,
              createdAt: { gte: featThirty, lte: featNow },
            },
          })
          .catch(() => 0),
        prisma.lead
          .count({
            where: {
              orgId: scope.orgId,
              propertyId: featuredProperty.id,
              createdAt: { gte: featSixty, lt: featThirty },
            },
          })
          .catch(() => 0),
        prisma.chatbotConversation
          .count({
            where: {
              orgId: scope.orgId,
              propertyId: featuredProperty.id,
              createdAt: { gte: featThirty, lte: featNow },
            },
          })
          .catch(() => 0),
        prisma.chatbotConversation
          .count({
            where: {
              orgId: scope.orgId,
              propertyId: featuredProperty.id,
              createdAt: { gte: featSixty, lt: featThirty },
            },
          })
          .catch(() => 0),
        prisma.visitor
          .count({
            where: {
              orgId: scope.orgId,
              propertyId: featuredProperty.id,
              status: "IDENTIFIED",
              firstSeenAt: { gte: featThirty, lte: featNow },
            },
          })
          .catch(() => 0),
        prisma.visitor
          .count({
            where: {
              orgId: scope.orgId,
              propertyId: featuredProperty.id,
              status: "IDENTIFIED",
              firstSeenAt: { gte: featSixty, lt: featThirty },
            },
          })
          .catch(() => 0),
        prisma.visitor
          .count({
            where: {
              orgId: scope.orgId,
              status: "IDENTIFIED",
              firstSeenAt: { gte: featThirty, lte: featNow },
            },
          })
          .catch(() => 0),
        prisma.visitor
          .count({
            where: {
              orgId: scope.orgId,
              status: "IDENTIFIED",
              firstSeenAt: { gte: featSixty, lt: featThirty },
            },
          })
          .catch(() => 0),
        prisma.tour
          .count({
            where: {
              propertyId: featuredProperty.id,
              createdAt: { gte: featThirty, lte: featNow },
            },
          })
          .catch(() => 0),
        prisma.application
          .count({
            where: {
              propertyId: featuredProperty.id,
              createdAt: { gte: featThirty, lte: featNow },
            },
          })
          .catch(() => 0),
        prisma.lease
          .count({
            where: {
              orgId: scope.orgId,
              propertyId: featuredProperty.id,
              status: "ACTIVE",
            },
          })
          .catch(() => 0),
      ]);

      // Fallback to org-wide identified visitor counts when the property-
      // scoped count is 0 — single-property orgs (TC) often have their
      // pixel installed at the org level and visitors don't carry a
      // propertyId. Better to attribute to the only active property than
      // to under-report.
      const identVisCur = fIdentVisCur > 0 ? fIdentVisCur : fIdentVisOrgWideCur;
      const identVisPrior =
        fIdentVisPrior > 0 ? fIdentVisPrior : fIdentVisOrgWidePrior;

      // Combined captured-contacts headline.
      const capturedCur =
        fLeadsCur + identVisCur + fConvosCur + fToursCur + fAppsCur;
      const capturedPrior = fLeadsPrior + identVisPrior + fConvosPrior;

      const fmt = (cur: number, prior: number) => {
        if (cur === 0 && prior === 0) return {};
        if (prior === 0) return { delta: "New", tone: "positive" as const };
        const pct = Math.round(((cur - prior) / prior) * 100);
        if (pct === 0) return { delta: "Flat", tone: "neutral" as const };
        return {
          delta: `${pct > 0 ? "+" : ""}${pct}% vs prior`,
          tone: pct > 0 ? ("positive" as const) : ("negative" as const),
        };
      };
      // Norman feedback (May 22): the operator clicked "173 Captured"
      // and landed on /portal/leads expecting 173 rows, saw 4, got
      // confused. Two fixes baked into each tile below:
      //   1. Inline `hint` spelling out the breakdown so the headline
      //      number isn't an opaque sum — operator reads "3 form + 147
      //      visitors + 23 chats" right under the value.
      //   2. `href` makes each tile click-through to the surface that
      //      actually holds that data (visitor feed, chatbot, leads
      //      page, etc.) instead of dumping everyone into /portal/leads.
      const breakdownHint = [
        fLeadsCur > 0 ? `${fLeadsCur} form` : null,
        identVisCur > 0 ? `${identVisCur} visitors` : null,
        fConvosCur > 0 ? `${fConvosCur} chats` : null,
        fToursCur > 0 ? `${fToursCur} tours` : null,
        fAppsCur > 0 ? `${fAppsCur} apps` : null,
      ]
        .filter(Boolean)
        .join(" + ");
      featuredStats = [
        {
          label: "Captured · 30d",
          value: capturedCur > 0 ? capturedCur.toLocaleString("en-US") : "—",
          hint: breakdownHint || undefined,
          // Captured is an aggregate — send the operator to the surface
          // that holds the LARGEST chunk of it (identified visitors for
          // a pixel-active tenant). The hint below the number names
          // every source so the navigation isn't a surprise.
          href:
            identVisCur >= fLeadsCur + fConvosCur
              ? "/portal/visitors"
              : "/portal/leads",
          ...fmt(capturedCur, capturedPrior),
        },
        {
          label: "Identified visitors",
          value: identVisCur > 0 ? identVisCur.toLocaleString("en-US") : "—",
          href: "/portal/visitors",
        },
        {
          label: "Chatbot · 30d",
          value: fConvosCur > 0 ? fConvosCur.toLocaleString("en-US") : "—",
          href: "/portal/chatbot",
        },
        {
          label: "Form leads · 30d",
          value: fLeadsCur > 0 ? fLeadsCur.toLocaleString("en-US") : "—",
          href: "/portal/leads",
        },
        {
          label: "Active leases",
          value:
            fActiveLeases > 0 ? fActiveLeases.toLocaleString("en-US") : "—",
          // No deep-link target — Operations is hidden in nav today and
          // we don't want to surface a leasing module that's intentionally
          // gated. Leave non-interactive.
        },
        {
          label: "Reputation",
          value:
            featuredProperty.googleAggRating != null
              ? `${featuredProperty.googleAggRating.toFixed(1)}★`
              : "—",
          href: "/portal/reputation",
        },
      ];
    }

    const featuredSubtitle = featuredProperty
      ? [
          [featuredProperty.city, featuredProperty.state]
            .filter(Boolean)
            .join(", ") || null,
          (
            featuredProperty.residentialSubtype ??
            featuredProperty.commercialSubtype ??
            featuredProperty.propertyType
          )
            ?.toString()
            .toLowerCase()
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

    return (
      <div className="space-y-2 ls-page-fade">
        {/* Auto-refresh dashboard data every 45s. Cheap — just re-runs the
          server-component Prisma queries against existing data the cron
          jobs and on-demand syncs keep fresh. No integration API calls. */}
        <AutoRefresh intervalMs={45_000} />

        {/* Page identity chrome — Carbon rebuild 2026-07-09. PageHeader
          replaces the animated greeting; the range pill group + property
          multi-select live in the actions slot, and the filtered-scope
          caption sits in the description slot. Range pills stay real
          Links so deep-links and back/forward navigation work without
          any client state. */}
        <PageHeader
          title="Dashboard"
          eyebrow={org?.name ?? undefined}
          meta={`as of ${asOfLabel} · last ${rangeDaysCount} days`}
          description={
            selectorProperties.length > 1
              ? isFiltered
                ? `Filtered to ${effectiveIds!.length} of ${selectorProperties.length} ${effectiveIds!.length === 1 ? "property" : "properties"}`
                : `Showing all ${selectorProperties.length} properties`
              : undefined
          }
          actions={
            <>
              <div
                className="inline-flex items-center rounded-none border border-[#e0e0e0] bg-white p-0"
                role="group"
                aria-label="Time range"
              >
                {RANGES.map((r) => (
                  <Link
                    key={r.key}
                    href={dashboardHref(r.key, compare)}
                    className={
                      r.key === range
                        ? "px-3 py-1 text-[12px] font-semibold rounded-none bg-[#0f62fe] text-white transition-colors"
                        : "px-3 py-1 text-[12px] font-semibold rounded-none text-[#525252] hover:bg-[#f4f4f4] transition-colors"
                    }
                    prefetch={false}
                  >
                    {r.label}
                  </Link>
                ))}
              </div>
              {selectorProperties.length > 1 ? (
                <PropertyMultiSelect
                  properties={selectorProperties}
                  orgId={scope.orgId}
                />
              ) : null}
            </>
          }
        />

        {accessDenied ? <PropertyAccessDeniedBanner /> : null}

        {/* The single setup surface — Carbon horizontal stepper. Absorbs
          FirstRunOverlay, OnboardingChecklistFloating, SetupWizardGate,
          and SetupBanner. Server state hides it once currentPhase
          reaches COMPLETED; no dismissal, no localStorage. */}
        {showChecklist && onboardingProgress ? (
          <OnboardingStepper
            progress={onboardingProgress}
            connectStatus={connectStatus}
          />
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
          dead QuickAccessTile component was deleted in the Carbon
          rebuild (2026-07-09). */}

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
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 ls-stagger"
        >
          {/* Norman bug #101: tiles needed explicit time windows, an honest
            empty-state for ad spend when no campaigns are active, an
            "Organic = unique website visitors" clarification, and the
            rent-roll occupancy tile removed (same theme as the property
            detail and dashboard rent-roll cleanup). */}
          <KpiTile
            density="dense"
            label="Leads (28d)"
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
          {/* Ad spend tile renders only when an ad account exists AND has
            real spend in the window. When ad modules are off, no
            campaigns exist, OR spend is zero, swap in the Tours tile so
            the row never reads as broken/inactive. */}
          {!adsOff && adSpend.spendUsd > 0 ? (
            <KpiTile
              density="dense"
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
            />
          ) : (
            <KpiTile
              density="dense"
              label="Tours scheduled (28d)"
              value={
                toursScheduled === 0 ? "—" : toursScheduled.toLocaleString()
              }
              hint={
                toursScheduled === 0
                  ? "Not tracked yet — connect a PMS tour feed"
                  : "Last 28 days"
              }
              icon={<CalendarCheck className="h-3.5 w-3.5" />}
              href="/portal/tours"
            />
          )}
          <KpiTile
            density="dense"
            label="Organic visitors (28d)"
            value={organic.sessions.toLocaleString()}
            // Reporter clarification: "Organic" was ambiguous. It's unique
            // website sessions matched to your property's URL patterns
            // via GSC (clicks) + GA4 (sessions). Spelling it out here
            // and in the hint avoids the "is this leads? page views?"
            // round-trip we kept having with operators.
            hint="Unique sessions from GSC + GA4"
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
          {/* Occupancy tile dropped per Norman feedback (#101) — rent-roll
            content is not the dashboard's focus. Properties tile takes
            the slot: total active properties + a link into the curate
            view. */}
          <KpiTile
            density="dense"
            label="Active properties"
            value={properties.length.toLocaleString()}
            hint={
              properties.length === 0
                ? "Add your first property"
                : "Click to view portfolio"
            }
            icon={<Building2 className="h-3.5 w-3.5" />}
            href="/portal/properties"
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
            eyebrow={compare ? "Current vs prior period" : "Daily volume"}
            title="Lead performance over time"
            description={`Leads created per day, last ${rangeDaysCount} days. Hover any point for the exact count.`}
            href="/portal/leads"
            hrefLabel="Open leads"
            className="lg:col-span-3"
          >
            <PerformanceOverTime points={performancePoints} compare={compare} />
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
            {propertiesInOnboarding > 0 ? (
              <Link
                href="/portal/properties?launch=ONBOARDING"
                className="mt-3 inline-flex items-center gap-1.5 rounded-[2px] border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 rounded-full bg-[#f1c21b]"
                />
                {propertiesInOnboarding.toLocaleString()}{" "}
                {propertiesInOnboarding === 1 ? "property" : "properties"} in
                onboarding
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            ) : null}
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
        {funnelStages.length > 0 || leadSourceSlices.length > 0 ? (
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

        {/* Featured-property band — demoted below the funnel row per the
          Carbon rebuild: identity chrome → setup → numbers → tables come
          first; the building photo is context, not the headline. Renders
          only when the operator has a LIVE featured property. */}
        {featuredProperty ? (
          <PropertyHeroBanner
            propertyId={featuredProperty.id}
            propertyName={featuredProperty.name}
            subtitle={featuredSubtitle}
            heroImageUrl={featuredProperty.heroImageUrl}
            stats={featuredStats}
            imageOffsetX={featuredProperty.heroImageOffsetX}
            imageOffsetY={featuredProperty.heroImageOffsetY}
            imageScale={featuredProperty.heroImageScale}
            compact
          />
        ) : null}

        {/* Activity feed — single full-width section. Previously this
              row had a "Top properties" inline list on the left that
              duplicated TopPropertiesLeaderboard above (same data, same
              ranking, different rendering). Removed the dup so the
              activity feed gets the breathing room it actually needs to
              read like a feed. */}
        <DashboardSection
          eyebrow="Recent"
          title="Activity feed"
          description="Latest events from leads, tours, ads, and your chatbot. Updates automatically."
          href="/portal/leads"
          hrefLabel="Open leads"
        >
          <ActivityFeed items={activity} />
        </DashboardSection>

        {/* --- Text rollup zone --------------------------------------
              Reordered 2026-06-03 per operator feedback: charts +
              metrics anchor the dashboard, and the three text-heavy
              recommendation stacks (Action items, SEO Agent, Insights
              hero) now follow Activity feed so the page reads as
              "here's what's happening" → "here's what to do next".
              --------------------------------------------------------- */}

        {/* Action items — top portfolio-wide recommendations from the
              Intelligence engine. */}
        {portfolioActions.length > 0 ? (
          <DashboardActionItems actions={portfolioActions} />
        ) : null}

        {/* SEO Agent rollup — sourced from the SEO recommendation
              engine. Only renders when there are open OPEN recs on
              LIVE properties. */}
        <PortfolioSeoActions actions={portfolioSeoActions} />

        {/* Insights hero — top 3 open insights with severity rollup. */}
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

        {/* AppFolio status — Carbon rebuild: the three hand-rolled branches
              (amber wash / emerald dot / blue-wash CTA card) collapse into
              one flat VerificationRow strip. The connect action is a ghost
              link, never a filled CTA — the onboarding stepper owns the
              single primary connect surface. */}
        <section className="rounded-[2px] border border-[#e0e0e0] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <VerificationRow
              status={
                appfolioAutoSyncPaused
                  ? "stale"
                  : appfolioConnected
                    ? "live"
                    : "not_connected"
              }
              accountLabel={
                appfolioConnected && appfolioRow?.instanceSubdomain && !appfolioAutoSyncPaused
                  ? `AppFolio · ${appfolioRow.instanceSubdomain}`
                  : "AppFolio"
              }
            />
            {appfolioAutoSyncPaused ? (
              <Link
                href="/portal/connect"
                className="text-[12px] font-medium text-[#0f62fe] hover:underline"
              >
                Enable auto-sync
              </Link>
            ) : appfolioConnected ? (
              <Link
                href="/portal/connect"
                className="text-[12px] font-medium text-[#0f62fe] hover:underline"
              >
                Manage
              </Link>
            ) : (
              <Link
                href="/portal/connect"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0f62fe] hover:underline"
              >
                Connect
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            )}
          </div>
        </section>
      </div>
    );
  } catch (err) {
    console.error("[PortalHome] Failed to load dashboard data:", err);
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" />
        <div className="rounded-[2px] border border-[#e0e0e0] bg-[#f4f4f4] px-4 py-3 text-sm text-foreground">
          Dashboard data could not be loaded. This is usually temporary — try
          refreshing. If the issue persists, check{" "}
          <a
            href="/portal/connect"
            className="underline font-medium text-primary"
          >
            the Connect hub
          </a>
          .
        </div>
      </div>
    );
  }
}

// Build a /portal URL that preserves the range + compare params. Page-level
// filters (property selector) live in their own search params and are
// handled by PropertyMultiSelect itself — keep this helper narrow.
// (Moved from dashboard-greeting.tsx's private hrefWith when the range
// pills relocated into the PageHeader actions slot.)
function dashboardHref(range: DashboardRange, compare: boolean): string {
  const params = new URLSearchParams();
  if (range !== "28d") params.set("range", range);
  if (compare) params.set("compare", "1");
  const qs = params.toString();
  return `/portal${qs ? `?${qs}` : ""}`;
}
