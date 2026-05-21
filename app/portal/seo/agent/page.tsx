import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, Gauge, LineChart, Link2, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { getCachedOrGenerateRecommendations } from "@/lib/seo/agent";
import { isDataforSeoConfigured } from "@/lib/seo/dataforseo";
import { isGooglePlacesConfigured } from "@/lib/seo/google-places";
import { PropertyIntelligencePanel } from "@/components/portal/properties/property-intelligence-panel";
import { ConnectWebsiteCard } from "@/components/portal/seo/connect-website-card";
import {
  IntegrationStatusRow,
  HealthScoreCard,
  SerpRankingsCard,
  LighthouseCard,
  BacklinksCard,
  CompetitorsCard,
  AeoCard,
  type SerpRow,
  type CompetitorRow,
  type IntegrationState,
} from "@/components/portal/seo/seo-data-cards";
import nextDynamic from "next/dynamic";
import {
  ExecSummaryRow,
  PositionBucketChart,
  CtrPositionScatter,
  StrikingDistanceTable,
  ShareOfVoiceDonut,
  KeywordPipelineFunnel,
  BrandedVsNonBrandedCard,
  SiteHealthGauge,
  LocalPackCard,
  type RangeKey,
} from "@/components/portal/seo/seo-phase2-charts";

// Heavy charts split into their own bundle chunks. ContentRoiTreemap pulls
// Recharts' Treemap, OpportunityMatrix pulls ScatterChart + ZAxis. Both
// land below the fold on /portal/seo/agent so deferring their parse is a
// clean win on time-to-interactive.
const ContentRoiTreemap = nextDynamic(
  () =>
    import("@/components/portal/seo/charts/content-roi-treemap").then(
      (m) => m.ContentRoiTreemap,
    ),
  { ssr: false, loading: () => <ChartPlaceholder height="h-[320px]" /> },
);
const OpportunityMatrix = nextDynamic(
  () =>
    import("@/components/portal/seo/charts/opportunity-matrix").then(
      (m) => m.OpportunityMatrix,
    ),
  { ssr: false, loading: () => <ChartPlaceholder height="h-[320px]" /> },
);
const SearchPathSankey = nextDynamic(
  () =>
    import("@/components/portal/seo/charts/search-path-sankey").then(
      (m) => m.SearchPathSankey,
    ),
  { ssr: false, loading: () => <ChartPlaceholder height="h-[360px]" /> },
);

function ChartPlaceholder({ height }: { height: string }) {
  return (
    <div
      className={`w-full ${height} rounded-xl border border-dashed border-border bg-card animate-pulse`}
    />
  );
}
import {
  getExecSummary,
  getPositionBucketSeries,
  getCtrScatterPoints,
  getStrikingDistance,
  getShareOfVoice,
  getOpportunityPoints,
  getContentRoiNodes,
  getPipelineFunnel,
  getBrandedSplit,
  getSiteHealth,
  getLocalPackRows,
  getScoreHistory,
  getSearchPathSankey,
} from "@/lib/seo/agent-charts-data";
import { DraftLauncher } from "@/components/portal/seo/draft-launcher";
import { TargetQueryManager } from "@/components/portal/seo/target-query-manager";
import { RefreshRecommendationsButton } from "@/components/portal/seo/refresh-recommendations-button";
import { ScoreHistoryChart } from "@/components/portal/seo/score-history-chart";
import { DraftsInbox } from "@/components/portal/seo/drafts-inbox";
import { PropertySwitcher } from "@/components/portal/seo/property-switcher";

export const metadata: Metadata = { title: "SEO Agent" };
export const dynamic = "force-dynamic";

function todayUtcStart(): Date {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
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
        <PageHeader />
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
  const aeoNotCited = aeoRecent.filter((a) => a.status === "NOT_CITED").length;
  const aeoCompetitorCited = aeoRecent.filter(
    (a) => a.status === "COMPETITOR_CITED",
  ).length;
  const citationRate = aeoTotal > 0 ? aeoCited / aeoTotal : 0;
  const ranksTop10 = serpToday.filter(
    (s) => s.ourRank != null && s.ourRank <= 10,
  ).length;
  const rankCoverage =
    targetQueryCountTotal > 0 ? ranksTop10 / targetQueryCountTotal : 0;

  // Weighted composite — 30% technical (perf+seo+a11y), 25% rank coverage,
  // 25% AEO citation rate, 20% backlink presence.
  let composite: number | null = null;
  const parts: number[] = [];
  if (performance != null && seoScore != null && accessibility != null) {
    const techNorm =
      ((performance <= 1 ? performance * 100 : performance) +
        (seoScore <= 1 ? seoScore * 100 : seoScore) +
        (accessibility <= 1 ? accessibility * 100 : accessibility)) /
      3;
    parts.push(0.3 * techNorm);
  }
  parts.push(0.25 * (rankCoverage * 100));
  parts.push(0.25 * (citationRate * 100));
  if (backlinksLatest?.domainRank != null) {
    parts.push(0.2 * (backlinksLatest.domainRank / 10));
  }
  if (parts.length >= 2) {
    composite = Math.round(parts.reduce((a, b) => a + b, 0));
    composite = Math.max(0, Math.min(100, composite));
  }

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

  // Phase 2 chart data — parallel fetch so the page renders fast.
  const [
    execSummary,
    positionBuckets,
    ctrScatter,
    strikingDistance,
    shareOfVoice,
    opportunityPoints,
    contentRoiNodes,
    pipelineStages,
    brandedSplit,
    siteHealth,
    localPackRows,
    scoreHistory,
    sankey,
  ] = await Promise.all([
    getExecSummary({ orgId: scope.orgId, propertyId: property.id, range }),
    getPositionBucketSeries({
      orgId: scope.orgId,
      propertyId: property.id,
      range,
    }),
    getCtrScatterPoints({
      orgId: scope.orgId,
      propertyId: property.id,
      range,
    }),
    getStrikingDistance({ orgId: scope.orgId, propertyId: property.id }),
    getShareOfVoice({
      orgId: scope.orgId,
      propertyId: property.id,
      ourDomain: domain,
    }),
    getOpportunityPoints({ orgId: scope.orgId, propertyId: property.id }),
    getContentRoiNodes({ orgId: scope.orgId, propertyId: property.id }),
    getPipelineFunnel({ orgId: scope.orgId, propertyId: property.id, range }),
    getBrandedSplit({ orgId: scope.orgId, propertyId: property.id, range }),
    getSiteHealth({ orgId: scope.orgId, propertyId: property.id }),
    getLocalPackRows({ orgId: scope.orgId, propertyId: property.id }),
    getScoreHistory({ orgId: scope.orgId, propertyId: property.id }),
    getSearchPathSankey({ orgId: scope.orgId, propertyId: property.id, range }),
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
      <PageHeader />

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

      {/* Phase 2: executive summary at the top so the operator gets the
          big numbers + WoW deltas before scrolling. Range selector
          pinned right of the header band. */}
      <ExecSummaryRow stats={execStats} />

      <HealthScoreCard
        composite={composite}
        pillars={[
          { label: "Perf.", value: performance },
          { label: "SEO", value: seoScore },
          { label: "A11y", value: accessibility },
          {
            label: "Top 10",
            value: targetQueryCountTotal > 0 ? rankCoverage * 100 : null,
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

      {/* Operator action bar — refresh recs + spawn a new draft. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Take action
          </h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Refresh recommendations or generate a draft. Drafts go to admin for review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshRecommendationsButton propertyId={property.id} />
          <DraftLauncher
            propertyId={property.id}
            propertyName={property.name}
          />
        </div>
      </div>

      {/* Recommendations — synthesized by lib/seo/agent.ts from real data.
          PropertyIntelligencePanel ALSO reads from the property
          recommendation engine (lib/intelligence/...) which has overlap;
          the SEO agent rules are a strict superset here. */}
      <PropertyIntelligencePanel
        propertyName={property.name}
        actions={recommendationsRaw.map((r) => ({
          id: r.kind,
          category:
            r.category === "CTR_FIX" || r.category === "ONPAGE_AUDIT"
              ? "seo"
              : r.category === "AEO_GAP" || r.category === "AEO_NOT_CITED"
                ? "aeo"
                : r.category === "NEIGHBORHOOD_PAGE" ||
                    r.category === "CONTENT_GAP" ||
                    r.category === "REFRESH" ||
                    r.category === "SCHEMA_GAP"
                  ? "content_freshness"
                  : r.category === "BACKLINK_OPPORTUNITY"
                    ? "competitor"
                    : "listing",
          severity:
            r.severity === "CRITICAL"
              ? "critical"
              : r.severity === "HIGH"
                ? "high"
                : r.severity === "MEDIUM"
                  ? "medium"
                  : "low",
          title: r.title,
          detail: r.detail,
          estimateMinutes: r.estimateMinutes,
          score: r.score,
          actionHref: r.actionHref ?? "/portal/seo",
          actionLabel: r.actionLabel ?? "Open",
          icon: "Sparkles",
        }))}
      />

      {/* Phase 2 — the composite views Norman called "the real magic." */}
      <KeywordPipelineFunnel stages={pipelineStages} />

      {/* Search path Sankey — top queries → landing URLs → outcomes. */}
      <SearchPathSankey nodes={sankey.nodes} links={sankey.links} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PositionBucketChart data={positionBuckets} />
        <CtrPositionScatter data={ctrScatter} />
      </div>

      <OpportunityMatrix points={opportunityPoints} />

      <StrikingDistanceTable rows={strikingDistance} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ShareOfVoiceDonut slices={shareOfVoice} />
        <BrandedVsNonBrandedCard
          branded={brandedSplit.branded}
          nonBranded={brandedSplit.nonBranded}
        />
      </div>

      <ContentRoiTreemap nodes={contentRoiNodes} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SiteHealthGauge
          score={siteHealth.score}
          critical={siteHealth.critical}
          warning={siteHealth.warning}
          notice={siteHealth.notice}
        />
        <LocalPackCard rows={localPackRows} />
      </div>

      {/* Drafts inbox — shows what the operator has sent for review,
          including admin notes when changes are requested. Hidden when
          the operator has zero drafts. */}
      <DraftsInbox propertyId={property.id} />

      {/* Score history — feeds the operator's "are we getting better?" question. */}
      <ScoreHistoryChart data={scoreHistory} />

      {/* Target queries — operators add/remove their own queries here. */}
      <TargetQueryManager propertyId={property.id} />

      <SerpRankingsCard rows={serpRows} totalQueries={targetQueryCountTotal} />

      <LighthouseCard
        scores={{
          performance: lighthouseToday?.performance ?? null,
          accessibility: lighthouseToday?.accessibility ?? null,
          bestPractices: lighthouseToday?.bestPractices ?? null,
          seo: lighthouseToday?.seo ?? null,
          pwa: lighthouseToday?.pwa ?? null,
        }}
        vitals={{
          fcpMs: lighthouseToday?.fcpMs ?? null,
          lcpMs: lighthouseToday?.lcpMs ?? null,
          cls: lighthouseToday?.cls ?? null,
          tbtMs: lighthouseToday?.tbtMs ?? null,
        }}
        url={property.websiteUrl}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BacklinksCard
          summary={
            backlinksLatest
              ? {
                  target: backlinksLatest.target,
                  domainRank: backlinksLatest.domainRank,
                  backlinks: backlinksLatest.backlinks,
                  referringDomains: backlinksLatest.referringDomains,
                  referringMainDomains: backlinksLatest.referringMainDomains,
                }
              : null
          }
        />
        <AeoCard
          citationRate={citationRate}
          cited={aeoCited}
          notCited={aeoNotCited}
          competitorCited={aeoCompetitorCited}
          totalChecks={aeoTotal}
        />
      </div>

      <CompetitorsCard rows={competitorRows} />

      <FooterNote
        dataforSeoOn={isDataforSeoConfigured()}
        googlePlacesOn={isGooglePlacesConfigured()}
        domain={domain}
      />
    </div>
  );
}

function PageHeader() {
  return (
    <header>
      <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-1">
        SEO &amp; AEO Agent
      </p>
      <h1 className="text-2xl font-semibold text-foreground leading-tight">
        Live search and AI visibility
      </h1>
      <p className="text-[12px] text-muted-foreground mt-1 max-w-2xl">
        We pull live data from Google, your Search Console, Lighthouse, DataforSEO, and the four major AI engines, then surface specific actions that move your rank, reviews, and lease velocity. Updated daily.
      </p>
    </header>
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
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-amber-800 mb-1">
        Setup pending
      </p>
      <p className="text-[12px] text-amber-900 leading-snug">
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
              className="underline font-semibold text-amber-900 hover:text-amber-700"
            >
              Manage integrations
            </Link>
          </>
        ) : null}
      </p>
    </section>
  );
}
