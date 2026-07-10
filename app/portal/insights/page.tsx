import type { Metadata } from "next";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  effectivePropertyIds,
  isAccessDenied,
  parsePropertyFilter,
  propertyIdsToWhere,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import { getInsightCounts, getOpenInsights } from "@/lib/insights/queries";
import { type InsightCardData } from "@/components/portal/insights/insight-card";
import { RunDetectorsButton } from "@/components/portal/insights/run-detectors-button";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { getLatestSnapshot, getSnapshotSeries } from "@/lib/signals/read";
import { pickHeadlineSignal } from "@/lib/signals/today";
import {
  SignalCard,
  SignalCardSkeleton,
} from "@/components/portal/insights/signal-card";
import { HeadlineCallout } from "@/components/portal/insights/headline-callout";
import {
  MentionFeed,
  type MentionRow,
} from "@/components/portal/insights/mention-feed";
import {
  TopMovers,
  type TopMoverRow,
} from "@/components/portal/insights/top-movers";
import { LeadHeatmap } from "@/components/portal/insights/lead-heatmap";
import { RecommendationsDrawer } from "@/components/portal/insights/recommendations-drawer";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    property?: string;
    properties?: string;
  }>;
}) {
  const gate = await requireModule("moduleInsights");
  if (gate) return gate;

  const scope = await requireScope();
  const params = await searchParams;

  // Tenancy / property scoping — unchanged from the prior page. Norman's
  // per-user property gate continues to win over any URL filter.
  const requestedIds = await parsePropertyFilter(params, scope.orgId);
  const accessDenied = isAccessDenied(scope, requestedIds);
  const effectiveIds = effectivePropertyIds(scope, requestedIds);
  // When a restricted user requests ONLY properties they can't see, effectiveIds
  // is [] and propertyIdsToWhere([]) would fall back to the org-wide (no-filter)
  // branch — leaking every building's data behind the "access denied" banner.
  // Force a match-nothing scope for every query on this page in that case.
  const scopedPropertyIds = accessDenied ? ["__access_denied__"] : effectiveIds;
  const propertyClause = propertyIdsToWhere(scopedPropertyIds);

  const since7d = new Date(Date.now() - 7 * 86_400_000);

  // Signal snapshots are computed at the ORG level by the daily cron
  // (scopeKey `tenant:orgId:_`). Read at that same scope — passing a
  // propertyId looks for a per-property snapshot the pipeline never produces,
  // which left this page permanently "first scan coming…" empty for every
  // single-property operator.
  const tenantScope = {
    kind: "tenant" as const,
    orgId: scope.orgId,
    propertyId: undefined,
  };

  const [latest, series14, mentions, leadRows, openInsightsRaw, counts, allProperties] =
    await Promise.all([
      getLatestSnapshot(tenantScope),
      getSnapshotSeries(tenantScope, 14),
      prisma.propertyMention.findMany({
        where: {
          orgId: scope.orgId,
          ...propertyClause,
          publishedAt: { gte: since7d },
        },
        orderBy: { publishedAt: "desc" },
        take: 8,
        select: {
          id: true,
          source: true,
          sourceUrl: true,
          title: true,
          excerpt: true,
          rating: true,
          sentiment: true,
          publishedAt: true,
          property: { select: { id: true, name: true } },
        },
      }),
      prisma.lead.findMany({
        where: {
          orgId: scope.orgId,
          ...propertyClause,
          createdAt: { gte: since7d },
        },
        select: { createdAt: true },
      }),
      // P1-2: pass the gated id list (mirrors getInsightCounts below) so a
      // property-restricted user with ≥2 properties never reaches the
      // unfiltered org-wide branch and sees other buildings' insights.
      getOpenInsights(scope.orgId, {
        propertyIds: scopedPropertyIds,
        limit: 20,
      }),
      getInsightCounts(scope.orgId, { propertyIds: scopedPropertyIds }),
      prisma.property.findMany({
        where: marketablePropertyWhere(scope.orgId),
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const properties = visibleProperties(scope, allProperties);

  // Cast Insight rows into the existing InsightCard shape used by the drawer.
  const openInsights: InsightCardData[] = openInsightsRaw.map((r) => ({
    id: r.id,
    kind: r.kind,
    category: r.category,
    severity: r.severity,
    status: r.status,
    title: r.title,
    body: r.body,
    suggestedAction: r.suggestedAction,
    href: r.href,
    createdAt: r.createdAt,
    property: r.property,
    context: (r.context as Record<string, unknown>) ?? null,
  }));

  const headline = pickHeadlineSignal(latest, series14);

  // Build a 14-day score series per signal so the sparklines stay aligned
  // even when a particular section was null on some days (fall back to 0).
  const overallSeries = series14.map((s) => s.overallScore ?? 0);
  const seoSeries = series14.map((s) => s.seo?.score ?? 0);
  const aeoSeries = series14.map((s) => s.aeo?.score ?? 0);
  const repSeries = series14.map((s) => s.reputation?.score ?? 0);

  // Chatbot + leads sparklines use their OWN snapshot sections — never a
  // proxy series. Days where the section didn't compute are dropped rather
  // than zero-filled (a zero-fill would draw a fake dip). Fewer than two
  // real points → empty series → SignalCard renders its honest
  // "No history yet" placeholder instead of a line.
  const chatbotSeries = realSeries(series14.map((s) => s.chatbot?.conversations));
  const leadsSeries = realSeries(series14.map((s) => s.leads?.newLeads));

  // Movers come from precomputed seo.topMovers; fall back to empty so the
  // component renders its "no notable moves" state rather than the "connect
  // your data" empty state.
  const movers: TopMoverRow[] = latest?.seo?.topMovers ?? [];
  const hasSeoData = !!latest?.seo;

  const wow = latest?.deltas7d ?? {};
  const mentionRows: MentionRow[] = mentions;
  const totalCounts = counts.critical + counts.warning + counts.info;

  // First-load state. When NO daily signal has computed yet AND we
  // also have nothing else to show (no mentions, no movers, no leads),
  // collapse the page to a single focused "first scan coming overnight"
  // card instead of stacking six empty sections (skeleton + headline
  // callout + mention feed + movers + heatmap + recommendations =
  // wall of emptiness, the exact UX issue this audit cycle is fixing).
  // The page restores its full layout the moment ANY one of those
  // surfaces has data.
  const isFirstLoad =
    !latest &&
    mentionRows.length === 0 &&
    movers.length === 0 &&
    leadRows.length === 0 &&
    openInsights.length === 0;

  return (
    <div className="space-y-5">
      {accessDenied ? <PropertyAccessDeniedBanner /> : null}
      <PageHeader
        eyebrow="Daily signal"
        title="Insights"
        description="Live look at what's moving for your portfolio — mentions, rankings, chatbot engagement, and leads. Updated every morning from a fresh signal scan."
        actions={
          <>
            {properties.length > 1 ? (
              <Suspense fallback={<div className="h-9 w-64 animate-pulse bg-neutral-100 rounded" />}>
                <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
              </Suspense>
            ) : null}
            <RunDetectorsButton />
          </>
        }
      />

      {isFirstLoad ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="First scan coming overnight"
          body="Your daily signal snapshot computes during off-hours. You'll see ranking, citation, reputation, chatbot, and lead activity here as soon as the first pass finishes — usually before the next morning."
          action={{ label: "Connect more data sources", href: "/portal/connect" }}
        />
      ) : null}

      {/* A. Hero strip — 6 signal cards */}
      {!isFirstLoad && latest ? (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SignalCard
            label="Overall score"
            value={`${latest.overallScore}`}
            caption="out of 100"
            deltaPct={numOrNull(wow.overallScore)}
            series={overallSeries}
            href="/portal/insights"
          />
          <SignalCard
            label="SEO rank"
            value={
              latest.seo?.avgPosition != null
                ? `#${Math.round(latest.seo.avgPosition)}`
                : "—"
            }
            caption={`${latest.seo?.organicKeywords ?? 0} keywords`}
            deltaPct={numOrNull(wow.seoScore)}
            series={seoSeries}
            href="/portal/seo"
          />
          <SignalCard
            label="AEO citations"
            value={
              latest.aeo
                ? `${Math.round(latest.aeo.citationRate * 100)}%`
                : "—"
            }
            caption={`${latest.aeo?.citationsFound ?? 0} of ${latest.aeo?.enginesChecked ?? 0} engines`}
            deltaPct={numOrNull(wow.aeoScore)}
            series={aeoSeries}
            href="/portal/seo"
          />
          <SignalCard
            label="Reputation"
            value={
              latest.reputation?.avgRating != null
                ? latest.reputation.avgRating.toFixed(1)
                : "—"
            }
            caption={`${latest.reputation?.totalMentions ?? 0} mentions`}
            deltaPct={numOrNull(wow.reputationScore)}
            series={repSeries}
            href="/portal/reputation"
          />
          <SignalCard
            label="Chatbot"
            value={`${latest.chatbot?.conversations ?? 0}`}
            caption="conversations · 24h"
            deltaPct={numOrNull(wow.chatbotConversations)}
            series={chatbotSeries}
            href="/portal/chatbot"
          />
          <SignalCard
            label="New leads"
            value={`${latest.leads?.newLeads ?? 0}`}
            caption="last 24h"
            deltaPct={numOrNull(wow.newLeads)}
            series={leadsSeries}
            href="/portal/leads"
          />
        </section>
      ) : !isFirstLoad ? (
        <FirstScanEmpty />
      ) : null}

      {!isFirstLoad ? (
        <>
          {/* B. Today's signal callout */}
          <HeadlineCallout signal={headline} />

          {/* C + D. Mention feed + Top movers, side-by-side on lg+ */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MentionFeed mentions={mentionRows} />
            <TopMovers movers={movers} hasData={hasSeoData} />
          </section>

          {/* E. Lead activity heatmap — the flashy centerpiece */}
          <section>
            <LeadHeatmap leadCreatedAt={leadRows.map((r) => r.createdAt)} />
          </section>

          {/* F. Existing recommendations, behind a drawer */}
          {openInsights.length > 0 ? (
            <RecommendationsDrawer insights={openInsights} />
          ) : totalCounts === 0 && !latest ? (
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title="Recommendations coming soon"
              body="Connect AppFolio, Google Analytics, your ad accounts, and the pixel — each unlocks a new family of detectors that run continuously in the background."
              action={{ label: "Connect your data", href: "/portal/connect" }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function FirstScanEmpty() {
  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-dashed border-border bg-card px-5 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">First scan coming overnight.</span>{" "}
        Your daily signal snapshot computes during off-hours — the strip below
        fills in as soon as the cron finishes its first pass.
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SignalCardSkeleton label="Overall score" />
        <SignalCardSkeleton label="SEO rank" />
        <SignalCardSkeleton label="AEO citations" />
        <SignalCardSkeleton label="Reputation" />
        <SignalCardSkeleton label="Chatbot" />
        <SignalCardSkeleton label="New leads" />
      </div>
    </section>
  );
}

function numOrNull(v: number | undefined | null): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return v;
}

/**
 * Keep only the days a signal section actually computed. Returns [] when
 * fewer than two real points exist — the honest "no history yet" case —
 * so no sparkline is ever drawn from synthesized or proxy data.
 */
function realSeries(values: Array<number | undefined>): number[] {
  const present = values.filter((v): v is number => v != null);
  return present.length >= 2 ? present : [];
}
