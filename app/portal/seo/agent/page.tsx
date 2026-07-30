import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, Gauge, LineChart, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { getCachedOrGenerateRecommendations } from "@/lib/seo/agent";
import { isDataforSeoConfigured } from "@/lib/seo/dataforseo";
import { isGooglePlacesConfigured } from "@/lib/seo/google-places";
import { PageHeader } from "@/components/admin/page-header";
import { ConnectWebsiteCard } from "@/components/portal/seo/connect-website-card";
import {
  IntegrationStatusRow,
  HealthScoreCard,
  SerpRankingsCard,
  BacklinksCard,
  CompetitorsCard,
  type SerpRow,
  type CompetitorRow,
  type IntegrationState,
} from "@/components/portal/seo/seo-data-cards";
import {
  ExecSummaryRow,
  RangeSelectorBar,
  StrikingDistanceTable,
  LocalPackCard,
  type RangeKey,
} from "@/components/portal/seo/seo-phase2-charts";
import {
  getExecSummary,
  getStrikingDistance,
  getSiteHealth,
  getLocalPackRows,
  getWeeklyChanges,
} from "@/lib/seo/agent-charts-data";
import { DraftLauncher } from "@/components/portal/seo/draft-launcher";
import { RefreshRecommendationsButton } from "@/components/portal/seo/refresh-recommendations-button";
import { PropertySwitcher } from "@/components/portal/seo/property-switcher";
import { RecommendationManager } from "@/components/portal/seo/recommendation-manager";
import { SnoozedRecsPanel } from "@/components/portal/seo/snoozed-recs-panel";
import { WeeklyChangesPanel } from "@/components/portal/seo/weekly-changes-panel";
import { TabbedCard } from "@/components/portal/ui/tabbed-card";

export const metadata: Metadata = { title: "SEO Agent" };
export const dynamic = "force-dynamic";

function todayUtcStart(): Date {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

// Weighted composite health score — 30% technical (perf+seo+a11y), 25% rank
// coverage, 25% AEO citation rate, 20% backlink presence. Each pillar is only
// included once its underlying data actually exists (regression
// PORTAL-SEO-D001: a property with zero target queries and zero AEO scans
// must show "no data" — not a fake 0/100 — so rankCoverage/citationRate
// defaulting to 0 must not masquerade as real signal).
export function computeCompositeHealthScore(input: {
  performance: number | null;
  seoScore: number | null;
  accessibility: number | null;
  targetQueryCountTotal: number;
  rankCoverage: number;
  aeoTotal: number;
  citationRate: number;
  backlinkDomainRank: number | null;
}): number | null {
  const parts: number[] = [];
  if (
    input.performance != null &&
    input.seoScore != null &&
    input.accessibility != null
  ) {
    const techNorm =
      ((input.performance <= 1 ? input.performance * 100 : input.performance) +
        (input.seoScore <= 1 ? input.seoScore * 100 : input.seoScore) +
        (input.accessibility <= 1
          ? input.accessibility * 100
          : input.accessibility)) /
      3;
    parts.push(0.3 * techNorm);
  }
  if (input.targetQueryCountTotal > 0) {
    parts.push(0.25 * (input.rankCoverage * 100));
  }
  if (input.aeoTotal > 0) {
    parts.push(0.25 * (input.citationRate * 100));
  }
  if (input.backlinkDomainRank != null) {
    parts.push(0.2 * (input.backlinkDomainRank / 10));
  }
  if (parts.length < 2) return null;
  return Math.max(0, Math.min(100, Math.round(parts.reduce((a, b) => a + b, 0))));
}

function deriveDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(
      /^www\./,
      "",
    );
  } catch {
    return null;
  }
}

export default async function SeoAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; range?: string }>;
}) {
  const scope = await requireScope();
  const { propertyId: propertyIdParam, range: rangeParam } = await searchParams;
  const range: RangeKey = (
    ["7d", "28d", "90d", "12mo"] as const
  ).includes(rangeParam as RangeKey)
    ? (rangeParam as RangeKey)
    : "28d";

  // Pick the featured property: explicit ?propertyId param wins; otherwise
  // the first LIVE marketable property in the org (the SG Real Estate /
  // Telegraph Commons single-property case).
  const properties = await prisma.property.findMany({
    where: {
      ...marketablePropertyWhere(scope.orgId),
      ...(scope.allowedPropertyIds
        ? { id: { in: scope.allowedPropertyIds } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      websiteUrl: true,
      slug: true,
      launchStatus: true,
    },
    orderBy: [{ launchStatus: "asc" }, { name: "asc" }],
  });

  if (properties.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="SEO & AEO Agent"
          title="Live search and AI visibility"
          description="We pull live data from Google, your Search Console, Lighthouse, DataforSEO, and the four major AI engines, then surface specific actions that move your rank, reviews, and lease velocity. Updated daily."
          actions={
            <>
              <a
                href="/api/portal/seo/recommendations/export"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
                title="Export open recommendations as CSV"
              >
                Export CSV
              </a>
              <Link
                href="/portal/seo/properties"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                Portfolio →
              </Link>
              <Link
                href="/portal/seo/recommendations"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                Archive →
              </Link>
              <Link
                href="/portal/seo/drafts"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                Drafts inbox →
              </Link>
            </>
          }
        />
        <section className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Add a property in /portal/properties to start using the SEO Agent.
          </p>
        </section>
      </div>
    );
  }

  const property =
    properties.find((p) => p.id === propertyIdParam) ??
    properties.find((p) => p.launchStatus === "LIVE") ??
    properties[0];

  if (propertyIdParam && propertyIdParam !== property.id) {
    // Property-restricted user requested a property they don't have access
    // to. Bounce back to the agent without the override.
    redirect("/portal/seo/agent");
  }

  // ──────────────────────────────────────────────────────────────────────
  // Parallel fetch every panel's data so the page lights up fast.
  // ──────────────────────────────────────────────────────────────────────
  const today = todayUtcStart();
  const domain = deriveDomain(property.websiteUrl);

  const [
    targetQueries,
    serpToday,
    serpYesterday,
    lighthouseToday,
    backlinksLatest,
    googleNearbyCompetitors,
    organicCompetitors,
    aeoRecent,
    recommendationsRaw,
    persistedRecs,
    seoIntegrations,
    targetQueryCountTotal,
  ] = await Promise.all([
    prisma.seoTargetQuery
      .findMany({
        where: { orgId: scope.orgId, propertyId: property.id, active: true },
        orderBy: { createdAt: "asc" },
      })
      .catch(() => []),
    prisma.serpRanking
      .findMany({
        where: { orgId: scope.orgId, propertyId: property.id, date: today },
        orderBy: { createdAt: "asc" },
      })
      .catch(() => []),
    prisma.serpRanking
      .findMany({
        where: {
          orgId: scope.orgId,
          propertyId: property.id,
          date: new Date(today.getTime() - 24 * 60 * 60 * 1000),
        },
      })
      .catch(() => []),
    prisma.onPageAudit
      .findFirst({
        where: { orgId: scope.orgId, propertyId: property.id },
        orderBy: { date: "desc" },
      })
      .catch(() => null),
    prisma.backlinkSummary
      .findFirst({
        where: { orgId: scope.orgId, propertyId: property.id },
        orderBy: { date: "desc" },
      })
      .catch(() => null),
    prisma.propertyCompetitorScan
      .findMany({
        where: {
          propertyId: property.id,
          source: "GOOGLE_PLACES_NEARBY",
        },
        orderBy: { distanceMeters: "asc" },
        take: 5,
      })
      .catch(() => []),
    prisma.propertyCompetitorScan
      .findMany({
        where: {
          propertyId: property.id,
          source: "DATAFORSEO_COMPETITORS_DOMAIN",
        },
        orderBy: { scannedAt: "desc" },
        take: 5,
      })
      .catch(() => []),
    prisma.aeoCitationCheck
      .findMany({
        where: {
          orgId: scope.orgId,
          propertyId: property.id,
          queryRunAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: { status: true },
      })
      .catch(() => []),
    getCachedOrGenerateRecommendations({
      orgId: scope.orgId,
      propertyId: property.id,
    }).catch(() => []),
    // Persisted recommendations for the operator's status workflow.
    // OPEN + IN_PROGRESS + SNOOZED. Manager filters to the first two,
    // SnoozedRecsPanel handles the third.
    prisma.seoActionRecommendation
      .findMany({
        where: {
          orgId: scope.orgId,
          propertyId: property.id,
          status: { in: ["OPEN", "IN_PROGRESS", "SNOOZED"] },
        },
        orderBy: [{ severity: "asc" }, { score: "desc" }],
        take: 30,
        select: {
          id: true,
          category: true,
          severity: true,
          title: true,
          detail: true,
          estimateMinutes: true,
          score: true,
          actionHref: true,
          actionLabel: true,
          status: true,
          snoozedUntil: true,
          snoozedReason: true,
        },
      })
      .catch(() => []),
    prisma.seoIntegration
      .findMany({
        where: { orgId: scope.orgId },
        select: { provider: true, lastSyncAt: true, propertyId: true },
      })
      .catch(() => []),
    prisma.seoTargetQuery
      .count({
        where: { orgId: scope.orgId, propertyId: property.id, active: true },
      })
      .catch(() => 0),
  ]);

  // ──────────────────────────────────────────────────────────────────────
  // Compose card data
  // ──────────────────────────────────────────────────────────────────────

  // Integration status row.
  const ga4 = seoIntegrations.find(
    (i) => i.provider === "GA4" && (!i.propertyId || i.propertyId === property.id),
  );
  const gsc = seoIntegrations.find(
    (i) => i.provider === "GSC" && (!i.propertyId || i.propertyId === property.id),
  );
  const integrations: Array<{
    label: string;
    icon: React.ReactNode;
    state: IntegrationState;
    connectHref?: string;
  }> = [
    {
      label: "Google Analytics",
      icon: <LineChart className="h-3.5 w-3.5" />,
      state: ga4
        ? {
            connected: true,
            lastSyncAt: ga4.lastSyncAt,
            detail: ga4.lastSyncAt
              ? `Synced ${ga4.lastSyncAt.toLocaleDateString()}`
              : "Connected",
          }
        : { connected: false, reason: "Not connected" },
      connectHref: ga4 ? undefined : "/portal/connect",
    },
    {
      label: "Search Console",
      icon: <Search className="h-3.5 w-3.5" />,
      state: gsc
        ? {
            connected: true,
            lastSyncAt: gsc.lastSyncAt,
            detail: gsc.lastSyncAt
              ? `Synced ${gsc.lastSyncAt.toLocaleDateString()}`
              : "Connected",
          }
        : { connected: false, reason: "Not connected" },
      connectHref: gsc ? undefined : "/portal/connect",
    },
    {
      label: "DataforSEO",
      icon: <Gauge className="h-3.5 w-3.5" />,
      state: isDataforSeoConfigured()
        ? {
            connected: true,
            lastSyncAt: null,
            detail: "Live keyword + SERP data",
          }
        : { connected: false, reason: "Awaiting platform setup" },
    },
    {
      label: "AEO scanner",
      icon: <Bot className="h-3.5 w-3.5" />,
      state:
        aeoRecent.length > 0
          ? {
              connected: true,
              lastSyncAt: null,
              detail: `${aeoRecent.length} AI prompts scored`,
            }
          : { connected: false, reason: "Schedule first scan" },
      connectHref: aeoRecent.length === 0 ? "/portal/seo/aeo" : undefined,
    },
  ];

  // Composite health score.
  const performance = lighthouseToday?.performance ?? null;
  const seoScore = lighthouseToday?.seo ?? null;
  const accessibility = lighthouseToday?.accessibility ?? null;
  const aeoTotal = aeoRecent.length;
  const aeoCited = aeoRecent.filter((a) => a.status === "CITED").length;
  const citationRate = aeoTotal > 0 ? aeoCited / aeoTotal : 0;
  const ranksTop10 = serpToday.filter(
    (s) => s.ourRank != null && s.ourRank <= 10,
  ).length;
  const rankCoverage =
    targetQueryCountTotal > 0 ? ranksTop10 / targetQueryCountTotal : 0;

  const composite = computeCompositeHealthScore({
    performance,
    seoScore,
    accessibility,
    targetQueryCountTotal,
    rankCoverage,
    aeoTotal,
    citationRate,
    backlinkDomainRank: backlinksLatest?.domainRank ?? null,
  });

  // SERP rankings table — join targetQueries with serpToday + delta.
  const serpRows: SerpRow[] = targetQueries.map((tq) => {
    const today = serpToday.find((s) => s.query === tq.query);
    const prior = serpYesterday.find((s) => s.query === tq.query);
    let delta: number | null = null;
    if (today && prior && today.ourRank != null && prior.ourRank != null) {
      // Positive delta = improvement (rank went down = better).
      delta = prior.ourRank - today.ourRank;
    }
    const topResultsArr =
      today?.topResults != null && Array.isArray(today.topResults)
        ? (today.topResults as unknown as SerpRow["topResults"])
        : [];
    return {
      query: tq.query,
      ourRank: today?.ourRank ?? null,
      ourUrl: today?.ourUrl ?? null,
      topResults: topResultsArr,
      delta,
    };
  });

  // Actionable surfaces only — parallel fetch. (The vanity data-viz fetches —
  // position buckets, CTR scatter, opportunity points, content-ROI, pipeline
  // funnel, branded split, score history, search-path Sankey — were removed
  // with their charts in the 2026-06-10 declutter.)
  const [
    execSummary,
    strikingDistance,
    siteHealth,
    localPackRows,
    weeklyChanges,
  ] = await Promise.all([
    getExecSummary({ orgId: scope.orgId, propertyId: property.id, range }),
    getStrikingDistance({ orgId: scope.orgId, propertyId: property.id }),
    getSiteHealth({ orgId: scope.orgId, propertyId: property.id }),
    getLocalPackRows({ orgId: scope.orgId, propertyId: property.id }),
    getWeeklyChanges({ orgId: scope.orgId, propertyId: property.id }),
  ]);

  // Build the exec-summary stats array. Delta arrows are NULL when we
  // have no prior-period data so the UI doesn't render misleading
  // "0% vs nothing" hints.
  const execStats = [
    {
      label: "Total clicks",
      value: execSummary.totalClicks.current.toLocaleString(),
      delta:
        execSummary.totalClicks.prior > 0
          ? Math.round(
              ((execSummary.totalClicks.current -
                execSummary.totalClicks.prior) /
                execSummary.totalClicks.prior) *
                100,
            )
          : null,
      deltaPct: true,
    },
    {
      label: "Impressions",
      value: execSummary.totalImpressions.current.toLocaleString(),
      delta:
        execSummary.totalImpressions.prior > 0
          ? Math.round(
              ((execSummary.totalImpressions.current -
                execSummary.totalImpressions.prior) /
                execSummary.totalImpressions.prior) *
                100,
            )
          : null,
      deltaPct: true,
    },
    {
      label: "Avg position",
      value:
        execSummary.avgPosition.current != null
          ? execSummary.avgPosition.current.toFixed(1)
          : "—",
      delta:
        execSummary.avgPosition.current != null &&
        execSummary.avgPosition.prior != null
          ? Number(
              (
                execSummary.avgPosition.current -
                execSummary.avgPosition.prior
              ).toFixed(1),
            )
          : null,
      inverted: true,
      deltaPct: false,
    },
    {
      label: "Ranked kws",
      value: execSummary.rankedKeywords.current.toLocaleString(),
      delta:
        execSummary.rankedKeywords.current -
        execSummary.rankedKeywords.prior,
      deltaPct: false,
    },
    {
      label: "Top 10",
      value: execSummary.topTen.current.toLocaleString(),
      delta: execSummary.topTen.current - execSummary.topTen.prior,
      deltaPct: false,
    },
    {
      label: "Est. traffic",
      value: execSummary.estTraffic.current.toLocaleString(),
      delta:
        execSummary.estTraffic.prior > 0
          ? Math.round(
              ((execSummary.estTraffic.current -
                execSummary.estTraffic.prior) /
                execSummary.estTraffic.prior) *
                100,
            )
          : null,
      deltaPct: true,
    },
  ];

  // Self-explaining layer (refactor 2026-06-10): a plain-English line per
  // metric + a good/ok/bad benchmark dot where there's a sensible threshold.
  // Avg position is the clearest benchmark (top 10 = page 1).
  const avgPosNow = execSummary.avgPosition.current;
  const STAT_SUBLABEL: Record<string, string> = {
    "Total clicks": "Visits from Google search",
    Impressions: "Times you appeared in Google results",
    "Avg position": "Average Google rank · top 10 = page 1",
    "Ranked kws": "Keywords you rank for at all",
    "Top 10": "Keywords sitting on page 1 of Google",
    "Est. traffic": "Estimated monthly search visits",
  };
  const execStatsEnriched = execStats.map((s) => ({
    ...s,
    sublabel: STAT_SUBLABEL[s.label],
    tone:
      s.label === "Avg position" && avgPosNow != null
        ? avgPosNow <= 10
          ? ("good" as const)
          : avgPosNow <= 20
            ? ("ok" as const)
            : ("bad" as const)
        : undefined,
  }));

  // Competitors — merge Google Places + DataforSEO into one ranked list.
  const competitorRows: CompetitorRow[] = [
    ...googleNearbyCompetitors.map((c) => ({
      name: c.competitorName,
      source: c.source as "GOOGLE_PLACES_NEARBY",
      url: c.competitorUrl,
      distanceMeters: c.distanceMeters,
      rating: c.rating,
      reviewCount: c.reviewCount,
    })),
    ...organicCompetitors.map((c) => {
      const rq = c.rankingQueries as { intersections?: number } | null;
      return {
        name: c.competitorName,
        source: c.source as "DATAFORSEO_COMPETITORS_DOMAIN",
        url: c.competitorUrl,
        distanceMeters: c.distanceMeters,
        rating: c.rating,
        reviewCount: c.reviewCount,
        intersections: rq?.intersections,
      };
    }),
  ];

  return (
    <div className="space-y-5 ls-page-fade">
      <PageHeader
        eyebrow="SEO & AEO Agent"
        title="Live search and AI visibility"
        description="We pull live data from Google, your Search Console, Lighthouse, DataforSEO, and the four major AI engines, then surface specific actions that move your rank, reviews, and lease velocity. Updated daily."
        actions={
          <>
            <a
              href="/api/portal/seo/recommendations/export"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
              title="Export open recommendations as CSV"
            >
              Export CSV
            </a>
            <Link
              href="/portal/seo/properties"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              Portfolio →
            </Link>
            <Link
              href="/portal/seo/recommendations"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              Archive →
            </Link>
            <Link
              href="/portal/seo/drafts"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              Drafts inbox →
            </Link>
            <Link
              href="/portal/seo/aeo"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              AI search →
            </Link>
          </>
        }
      />

      <PropertySwitcher properties={properties} activeId={property.id} />

      <ConnectWebsiteCard
        propertyId={property.id}
        initialWebsiteUrl={property.websiteUrl}
        initialCoverage={{
          targetQueries: targetQueryCountTotal,
          serpRankingsToday: serpToday.length,
          auditsToday: lighthouseToday ? 1 : 0,
          backlinksToday: backlinksLatest ? 1 : 0,
          competitorsTotal:
            googleNearbyCompetitors.length + organicCompetitors.length,
          recommendationsTotal: recommendationsRaw.length,
        }}
      />

      <IntegrationStatusRow integrations={integrations} />

      {/* The numbers — Search Console + DataForSEO KPIs with WoW deltas +
          plain-English sublabels + a benchmark dot. */}
      <div className="flex items-center justify-end">
        <RangeSelectorBar value={range} />
      </div>
      <ExecSummaryRow stats={execStatsEnriched} />

      <TabbedCard
        title="Your SEO workspace"
        tabs={[
          {
            key: "action-plan",
            label: "Action Plan",
            description:
              "Ranked most-impactful first — time to do and expected lift, from your live search + AI data.",
            content: (
              <div className="space-y-5">
                <div className="flex items-center justify-end gap-2">
                  <RefreshRecommendationsButton propertyId={property.id} />
                  <DraftLauncher
                    propertyId={property.id}
                    propertyName={property.name}
                  />
                </div>

                <WeeklyChangesPanel changes={weeklyChanges} />

                {/* Recommendation workflow — OPEN + IN_PROGRESS only.
                    SNOOZED rows render in SnoozedRecsPanel below so the
                    active queue stays focused on what needs work now. */}
                <RecommendationManager
                  recommendations={persistedRecs
                    .filter(
                      (r) => r.status === "OPEN" || r.status === "IN_PROGRESS",
                    )
                    .map((r) => ({
                      id: r.id,
                      category: r.category,
                      severity: r.severity,
                      title: r.title,
                      detail: r.detail,
                      estimateMinutes: r.estimateMinutes,
                      score: r.score,
                      actionHref: r.actionHref,
                      actionLabel: r.actionLabel,
                      status: r.status as "OPEN" | "IN_PROGRESS",
                    }))}
                />

                <SnoozedRecsPanel
                  recommendations={persistedRecs
                    .filter((r) => r.status === "SNOOZED" && r.snoozedUntil)
                    .map((r) => ({
                      id: r.id,
                      title: r.title,
                      severity: r.severity,
                      category: r.category,
                      snoozedUntil: r.snoozedUntil!.toISOString(),
                      snoozedReason: r.snoozedReason,
                    }))}
                />

                <p className="text-[11px] text-muted-foreground">
                  Drafts and target queries live in the{" "}
                  <Link className="underline" href="/portal/seo/drafts">
                    Drafts inbox →
                  </Link>
                </p>
              </div>
            ),
          },
          {
            key: "health",
            label: "Health",
            description:
              "Composite score, site health, and Lighthouse in one place.",
            content: (
              <div className="space-y-5">
                <HealthScoreCard
                  bare
                  composite={composite}
                  pillars={[
                    { label: "Perf.", value: performance },
                    { label: "SEO", value: seoScore },
                    { label: "A11y", value: accessibility },
                    {
                      label: "Top 10",
                      value:
                        targetQueryCountTotal > 0 ? rankCoverage * 100 : null,
                    },
                    {
                      label: "AEO",
                      value: aeoTotal > 0 ? citationRate * 100 : null,
                    },
                    {
                      label: "Domain",
                      value:
                        backlinksLatest?.domainRank != null
                          ? backlinksLatest.domainRank / 10
                          : null,
                    },
                  ]}
                />
                <ScoreStrip siteHealth={siteHealth} lighthouse={lighthouseToday} />
              </div>
            ),
          },
          {
            key: "rankings",
            label: "Rankings",
            description:
              "Target queries, striking-distance wins, and the local pack.",
            content: (
              <div className="space-y-5">
                <StrikingDistanceTable bare rows={strikingDistance} />
                <SerpRankingsCard
                  bare
                  rows={serpRows}
                  totalQueries={targetQueryCountTotal}
                />
                <LocalPackCard bare rows={localPackRows} />
              </div>
            ),
          },
          {
            key: "backlinks-competitors",
            label: "Backlinks & Competitors",
            description: "Domain authority and who you're up against.",
            content: (
              <div className="space-y-5">
                <BacklinksCard
                  bare
                  summary={
                    backlinksLatest
                      ? {
                          target: backlinksLatest.target,
                          domainRank: backlinksLatest.domainRank,
                          backlinks: backlinksLatest.backlinks,
                          referringDomains: backlinksLatest.referringDomains,
                          referringMainDomains:
                            backlinksLatest.referringMainDomains,
                        }
                      : null
                  }
                />
                <CompetitorsCard bare rows={competitorRows} />
              </div>
            ),
          },
        ]}
      />

      <FooterNote
        dataforSeoOn={isDataforSeoConfigured()}
        googlePlacesOn={isGooglePlacesConfigured()}
        domain={domain}
      />
    </div>
  );
}

function FooterNote({
  dataforSeoOn,
  googlePlacesOn,
  domain,
}: {
  dataforSeoOn: boolean;
  googlePlacesOn: boolean;
  domain: string | null;
}) {
  if (dataforSeoOn && googlePlacesOn) return null;
  return (
    <section className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
      <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-1">
        Setup pending
      </p>
      <p className="text-[12px] text-foreground leading-snug">
        {!dataforSeoOn && !googlePlacesOn
          ? "DataforSEO and Google Places API keys are not configured. SERP rankings, Lighthouse audits, backlinks, and competitor data will appear once the platform team adds the keys in Vercel env vars."
          : !dataforSeoOn
            ? "DataforSEO is not configured. SERP rankings, Lighthouse audits, and backlinks will appear once the platform team adds DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD."
            : "Google Places API key is not configured. Nearby competitor data will appear once the platform team adds GOOGLE_PLACES_API_KEY."}
        {domain ? (
          <>
            {" "}
            <Link
              href="/portal/connect"
              className="underline font-semibold text-primary hover:text-primary/80"
            >
              Manage integrations
            </Link>
          </>
        ) : null}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ScoreStrip — merges SiteHealthGauge + LighthouseCard (refactor 2026-07-29)
// into one row of compact stat cells. Cells whose value is unavailable are
// OMITTED entirely, never rendered as 0 or an em-dash. The site-health four
// (score/critical/warning/notice) are also omitted as a group when there's
// no audit row at all — getSiteHealth returns all-zero in that case, and
// "0/100 · 0 critical" reads as a clean bill of health rather than "no
// data yet." Perf/A11y/SEO pillars live in HealthScoreCard above this
// strip in the same tab, so they aren't duplicated here.
// ---------------------------------------------------------------------------

function normalizeScore(value: number | null | undefined): number | null {
  if (value == null) return null;
  // Lighthouse scores are stored 0-100 on disk (dataforseo.ts rounds
  // score*100 before write) — no 0-1 heuristic needed.
  return Math.round(value);
}

function ScoreStrip({
  siteHealth,
  lighthouse,
}: {
  siteHealth: { score: number; critical: number; warning: number; notice: number };
  lighthouse: {
    bestPractices: number | null;
    fcpMs: number | null;
    lcpMs: number | null;
    cls: number | null;
    tbtMs: number | null;
  } | null;
}) {
  const cells: Array<{ label: string; value: string; color?: string }> = [];

  // Perf/A11y/SEO pillars already render in HealthScoreCard above this
  // strip in the same tab — omit the whole site-health block here only
  // when there's no audit row at all (all four fields 0), never show a
  // misleading "0/100 · 0 critical".
  const siteHealthAllZero =
    siteHealth.score === 0 &&
    siteHealth.critical === 0 &&
    siteHealth.warning === 0 &&
    siteHealth.notice === 0;
  if (!siteHealthAllZero) {
    cells.push(
      { label: "Site health", value: `${Math.round(siteHealth.score)}/100` },
      {
        label: "Critical issues",
        value: `${siteHealth.critical}`,
        color: siteHealth.critical > 0 ? "#da1e28" : undefined,
      },
      {
        label: "Warnings",
        value: `${siteHealth.warning}`,
        color: siteHealth.warning > 0 ? "#8a6d00" : undefined,
      },
      { label: "Notices", value: `${siteHealth.notice}` },
    );
  }

  const bestPractices = normalizeScore(lighthouse?.bestPractices ?? null);
  if (bestPractices != null)
    cells.push({ label: "Best practices", value: `${bestPractices}` });

  if (lighthouse?.fcpMs != null)
    cells.push({ label: "FCP", value: `${(lighthouse.fcpMs / 1000).toFixed(1)}s` });
  if (lighthouse?.lcpMs != null)
    cells.push({ label: "LCP", value: `${(lighthouse.lcpMs / 1000).toFixed(1)}s` });
  if (lighthouse?.cls != null)
    cells.push({ label: "CLS", value: lighthouse.cls.toFixed(2) });
  if (lighthouse?.tbtMs != null)
    cells.push({ label: "TBT", value: `${lighthouse.tbtMs}ms` });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {cells.map((c) => (
        <div key={c.label} className="rounded-[2px] border border-border p-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground">
            {c.label}
          </p>
          <p
            className="text-[13px] font-semibold tabular-nums mt-0.5"
            style={c.color ? { color: c.color } : undefined}
          >
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
