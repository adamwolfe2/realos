"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Sparkles } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { AeoScanButton } from "./aeo-scan-button";
import {
  AeoEngineCards,
  type EngineCardData,
} from "./aeo-engine-cards";
import {
  AeoResponsesTable,
  type ResponseRow,
} from "./aeo-responses-table";
import {
  ShareOfVoiceCard,
  type ShareOfVoiceProps,
} from "@/components/portal/aeo/share-of-voice-card";
import {
  OpportunityScoreCard,
  type OpportunityScoreProps,
} from "@/components/portal/aeo/opportunity-score-card";
import {
  AiOverviewCard,
  type AiOverviewProps,
} from "@/components/portal/aeo/ai-overview-card";
import {
  OnPageAuditCard,
  type OnPageAuditProps,
} from "@/components/portal/aeo/onpage-audit-card";

// All interactive UI for /portal/seo/aeo. The page.tsx server component
// does the data fetch + tenant scope, then hands fully-shaped view props
// down here. Keeping this client-side lets the responses table own its
// own search / group / filter state without forcing the whole page into
// a client component.

export type AeoClientProps = {
  engineCards: EngineCardData[];
  responses: ResponseRow[];
  competitorRollup: { name: string; count: number }[];
  lastScanAt: string | null;
  kpis: {
    visibilityScore: number;
    mentionRate30: number;
    last30Mentioned: number;
    citationRate30: number;
    last30Cited: number;
    last30Total: number;
    priorRate: number;
    prior30Total: number;
    trendDelta: number;
    competitorsNamed: number;
  };
  recommendations: Array<{
    severity: "high" | "medium" | "low";
    title: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  }>;
  shareOfVoice: ShareOfVoiceProps;
  opportunityScore: OpportunityScoreProps;
  aiOverview: AiOverviewProps;
  onPageAudit: OnPageAuditProps;
};

function fmtPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function fmtNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString();
}

// Visibility Score band — one-line plain-English read of the composite
// 0-100 score, same copy the old hand-rolled VisibilityScoreCard used.
function visibilityBandLabel(score: number, total: number): string {
  if (total === 0) return "No data yet — run your first scan";
  if (score >= 60) return "Strong — you're regularly named and cited";
  if (score >= 30) return "Emerging — being named, room to be cited more";
  return "Low visibility — see the actions below";
}

function NextActions({
  recs,
}: {
  recs: AeoClientProps["recommendations"];
}) {
  if (recs.length === 0) return null;
  return (
    <SectionCard
      label="What to do next"
      description="Actions derived from the AI responses on this page. Each links to where you can act."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {recs.map((rec, i) => {
          const sevTone =
            rec.severity === "high"
              ? "bg-primary"
              : rec.severity === "medium"
                ? "bg-primary/60"
                : "bg-muted-foreground/40";
          const sevLabel =
            rec.severity === "high"
              ? "High"
              : rec.severity === "medium"
                ? "Medium"
                : "Low";
          return (
            <div
              key={i}
              className="ls-card p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${sevTone}`} />
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
                  {sevLabel} priority
                </span>
              </div>
              <h3 className="text-[14px] font-semibold text-foreground leading-snug">
                {rec.title}
              </h3>
              <p className="text-[12.5px] text-muted-foreground leading-relaxed line-clamp-4">
                {rec.body}
              </p>
              <a
                href={rec.ctaHref}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline mt-auto"
              >
                {rec.ctaLabel}
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function AeoClient({
  engineCards,
  responses,
  competitorRollup,
  lastScanAt,
  kpis,
  recommendations,
  shareOfVoice,
  opportunityScore,
  aiOverview,
  onPageAudit,
}: AeoClientProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          <a href="/portal/seo" className="hover:text-foreground">
            ← SEO
          </a>
        }
        eyebrow="AI ENGINE OPTIMIZATION"
        title="AI search visibility"
        description="When prospective renters ask ChatGPT, Perplexity, Claude, or Gemini for apartment recommendations in your market, do they get your property? Scans run automatically every Monday."
        meta={
          lastScanAt
            ? `last scan ${formatDistanceToNow(new Date(lastScanAt), {
                addSuffix: true,
              })}`
            : "never scanned"
        }
        actions={<AeoScanButton />}
      />

      {/* Visibility Score hero + 3-up micro KPIs — consolidated onto the
          canonical KpiTile (was two hand-rolled cards). The composite score
          drives the gauge; band copy + response count move into `hint`. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="AI Visibility"
          value={
            kpis.last30Total === 0 ? (
              "—"
            ) : (
              <>
                {kpis.visibilityScore}
                <span className="text-[13px] font-normal text-muted-foreground">
                  {" "}
                  / 100
                </span>
              </>
            )
          }
          hint={
            kpis.last30Total > 0
              ? `${visibilityBandLabel(kpis.visibilityScore, kpis.last30Total)} · ${fmtNumber(kpis.last30Total)} AI responses (30d)`
              : visibilityBandLabel(kpis.visibilityScore, kpis.last30Total)
          }
          gaugeValue={kpis.last30Total === 0 ? undefined : kpis.visibilityScore / 100}
          variant="accent"
        />
        <KpiTile
          label="Mention rate (30d)"
          value={fmtPercent(kpis.mentionRate30)}
          hint={
            kpis.last30Total > 0
              ? `${kpis.last30Mentioned} of ${kpis.last30Total} AI responses named you`
              : "No AI responses yet"
          }
        />
        <KpiTile
          label="Citation rate (30d)"
          value={fmtPercent(kpis.citationRate30)}
          hint={
            kpis.last30Total > 0
              ? `${kpis.last30Cited} of ${kpis.last30Total} responses linked your URL`
              : "Citation rate measures linked URLs only"
          }
        />
        <KpiTile
          label="Competitors named (30d)"
          value={fmtNumber(kpis.competitorsNamed)}
          hint="Unique buildings the AI named instead of you"
        />
      </div>

      {/* The actual AI prompts + responses — the most useful thing on the
          page, so it leads right under the score instead of being buried at
          the bottom. */}
      <div id="all-responses">
        <AeoResponsesTable rows={responses} />
      </div>

      {/* Per-engine cards — now show BOTH mention + citation per engine */}
      <AeoEngineCards rows={engineCards} />

      {/* AEO v2 W1: AI Share of Voice — populated when AEO_ENGINE_SOURCE=dataforseo */}
      <ShareOfVoiceCard
        perEngine={shareOfVoice.perEngine}
        topEntities={shareOfVoice.topEntities}
        totalSnapshots={shareOfVoice.totalSnapshots}
        engineSource={shareOfVoice.engineSource}
      />

      {/* AEO v2 W2: Opportunity Score — keywords ranked by gap */}
      <OpportunityScoreCard
        rows={opportunityScore.rows}
        engineSource={opportunityScore.engineSource}
      />

      {/* AEO v2 W2: Google AI Overview row */}
      <AiOverviewCard
        rows={aiOverview.rows}
        engineSource={aiOverview.engineSource}
      />

      {/* AEO v2 W3: AEO Page Health (gated behind AEO Boost addon) */}
      <OnPageAuditCard
        hasAddon={onPageAudit.hasAddon}
        defaultUrl={onPageAudit.defaultUrl}
        latest={onPageAudit.latest}
        history={onPageAudit.history}
      />

      {/* What to do next — derived recommendations */}
      <NextActions recs={recommendations} />

      {/* Competitors rollup — hoisted above the table since it's the
          single most actionable data on the page. Each row links to a
          counter-page draft pre-filled with the competitor's name. */}
      <SectionCard
        label="Competitors cited"
        description="Buildings the AI surfaced when your properties weren't (last 30 days). Click a row to draft a counter-page that names both."
      >
        {competitorRollup.length === 0 ? (
          <div className="text-[13px] text-muted-foreground py-2 inline-flex items-center gap-2">
            <Sparkles className="w-3 h-3" />
            No competitor names extracted yet. The scanner will populate this
            list as AI engines start mentioning rivals.
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
            {competitorRollup.map(({ name, count }) => (
              <li
                key={name}
                className="flex items-center justify-between gap-2 text-[13px] border-b border-[var(--hair)] last:border-b-0 py-1.5"
              >
                <span className="truncate text-foreground" title={name}>
                  {name}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {count}×
                  </span>
                  <a
                    href={`/portal/content/new?format=BLOG_POST&target=${encodeURIComponent(name)}`}
                    className="text-[11px] font-medium text-primary hover:underline"
                    title={`Draft a counter-page targeting ${name}`}
                  >
                    Counter →
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
