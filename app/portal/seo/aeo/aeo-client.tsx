"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { Sparkline } from "@/components/portal/ui/charts";
import { TabbedCard } from "@/components/portal/ui/tabbed-card";
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
  AeoCustomPrompts,
  type CustomPromptsProps,
} from "./aeo-custom-prompts";
import type { ShareOfVoiceProps } from "@/components/portal/aeo/share-of-voice-card";
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
import { mergeEntities, type MergedEntity } from "@/lib/aeo/merge-entities";

// All interactive UI for /portal/seo/aeo. The page.tsx server component
// does the data fetch + tenant scope, then hands fully-shaped view props
// down here. Keeping this client-side lets the responses table own its
// own search / group / filter state without forcing the whole page into
// a client component.

export type TrendWeek = {
  label: string;
  overall: number | null;
  byEngine: Record<string, number | null>;
};

export type AeoClientProps = {
  engineCards: EngineCardData[];
  responses: ResponseRow[];
  competitorRollup: { name: string; count: number }[];
  lastScanAt: string | null;
  /** Weekly mention-rate trend over the 60d window (2026-08-14). */
  trendWeeks: TrendWeek[];
  /** AI-referral attribution (2026-08-14): pixel sessions from AI
   *  assistants chained to leads + signed leases. */
  aiReferral: {
    visits: number;
    leads: number;
    signed: number;
    byEngine: Array<{ engine: string; visits: number }>;
    windowDays: number;
  };
  /** Per-engine competitor heatmap rows (2026-08-14, slice 9). */
  heatmapRows: Array<{
    name: string;
    isYou: boolean;
    cells: Array<{ engine: string; pct: number | null }>;
  }>;
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
  customPrompts: CustomPromptsProps;
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

// --- Share of Voice tab: merges the old ShareOfVoiceCard top-entities list
// with the bottom-of-page competitor rollup. NOTE: these are DIFFERENT
// tables counting overlapping events (aeoMentionSnapshot mentions vs
// aeoCitationCheck competitorsCited — one DataForSEO response writes both),
// so counts must never be summed across them. Merge semantics (max, self
// wins, "other" dropped) live in lib/aeo/merge-entities.ts (unit tested).

function engineLabel(e: ShareOfVoiceProps["perEngine"][number]["engine"]): string {
  switch (e) {
    case "CHATGPT":
      return "ChatGPT";
    case "CLAUDE":
      return "Claude";
    case "GEMINI":
      return "Gemini";
    case "PERPLEXITY":
      return "Perplexity";
    default:
      return String(e);
  }
}

// Per-engine SoV bars — copied from share-of-voice-card.tsx since that
// component's own render also draws the top-entities list we no longer
// want duplicated; simplest to re-render just the bars here.
function SovBars({ perEngine }: { perEngine: ShareOfVoiceProps["perEngine"] }) {
  const maxSov = perEngine.reduce(
    (m, row) => (row.avgSov > m ? row.avgSov : m),
    0,
  );
  function barWidth(v: number): string {
    if (maxSov <= 0) return "0%";
    const ratio = v / maxSov;
    if (ratio <= 0) return "0%";
    return `${Math.max(ratio * 100, 5)}%`;
  }
  const avgAcross =
    perEngine.length > 0
      ? perEngine.reduce((s, r) => s + r.avgSov, 0) / perEngine.length
      : 0;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-3">
        Per engine (30d avg)
      </div>
      <ul className="space-y-2.5">
        {perEngine.map((row) => (
          <li key={row.engine} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="font-medium text-foreground">{engineLabel(row.engine)}</span>
              <span className="tabular-nums text-foreground font-semibold">
                {fmtPercent(row.avgSov)}
                <span className="text-[10px] ml-2 font-normal text-muted-foreground">
                  n={row.snapshotCount}
                </span>
              </span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: barWidth(row.avgSov) }}
                aria-hidden
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-muted-foreground">
        You hold{" "}
        <span className="font-semibold text-foreground">
          {fmtPercent(avgAcross)}
        </span>{" "}
        of the AI conversation in your market, averaged across engines.
      </p>
    </div>
  );
}

function MergedEntityList({ entities }: { entities: MergedEntity[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-3">
        Who the AI engines mention (30d)
      </div>
      {entities.length === 0 ? (
        <div className="text-[13px] text-muted-foreground">
          No entities classified yet.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {entities.map((e) => (
            <li
              key={`${e.name}-${e.kind}`}
              className={`flex items-center justify-between gap-2 text-[13px] border-b border-border last:border-b-0 py-1.5 px-2 -mx-2 ${
                e.kind === "self" ? "bg-[#edf5ff]/60 rounded-[2px]" : ""
              }`}
            >
              <span
                className={`truncate ${e.kind === "self" ? "font-semibold" : ""} text-foreground`}
                title={e.name}
              >
                {e.name}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={
                    e.kind === "self"
                      ? "inline-flex items-center rounded-[2px] bg-[#edf5ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#0f62fe] uppercase tracking-wide"
                      : "text-[10px] uppercase tracking-wide text-muted-foreground"
                  }
                >
                  {e.kind === "self" ? "You" : "Competitor"}
                </span>
                <span className="tabular-nums text-[11px] text-muted-foreground">
                  {e.count}×
                </span>
                {e.kind === "competitor" ? (
                  <a
                    href={`/portal/content/new?format=BLOG_POST&target=${encodeURIComponent(e.name)}`}
                    className="text-[11px] font-medium text-primary hover:underline"
                    title={`Draft a counter-page targeting ${e.name}`}
                  >
                    Counter →
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ShareOfVoiceTab({
  shareOfVoice,
  competitorRollup,
}: {
  shareOfVoice: ShareOfVoiceProps;
  competitorRollup: { name: string; count: number }[];
}) {
  const isEmpty =
    shareOfVoice.totalSnapshots === 0 &&
    shareOfVoice.topEntities.length === 0 &&
    competitorRollup.length === 0;
  if (isEmpty) {
    // Same one-line status copy as share-of-voice-card.tsx's own empty
    // branch — no empty grid, no duplicated "No entities classified yet."
    return (
      <p className="text-[13px] text-muted-foreground py-2">
        {shareOfVoice.engineSource === "dataforseo"
          ? "Share of voice populates after your next weekly scan."
          : "AI search visibility is being activated for your account. Your first share-of-voice report lands within 24 hours."}
      </p>
    );
  }
  const merged = mergeEntities(shareOfVoice.topEntities, competitorRollup);
  const showBars = shareOfVoice.totalSnapshots > 0;
  return (
    <div className={showBars ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : ""}>
      {showBars ? <SovBars perEngine={shareOfVoice.perEngine} /> : null}
      <MergedEntityList entities={merged} />
    </div>
  );
}

export function AeoClient({
  engineCards,
  responses,
  competitorRollup,
  lastScanAt,
  trendWeeks,
  aiReferral,
  heatmapRows,
  kpis,
  recommendations,
  shareOfVoice,
  opportunityScore,
  aiOverview,
  onPageAudit,
  customPrompts,
}: AeoClientProps) {
  // Whole-card activation gate only — once ANY signal exists anywhere on
  // this page, all four tabs render unconditionally. Per-tab presence
  // gating previously hid each card's own empty state, which carries real
  // value: OpportunityScoreCard's dataforseo empty state links the GSC
  // connect remedy, and OnPageAuditCard's GatedView carries the AEO Boost
  // upgrade CTA for non-addon tenants — that purchase path must stay
  // reachable even when no other AEO v2 data exists yet.
  const anyData =
    opportunityScore.rows.length > 0 ||
    aiOverview.rows.length > 0 ||
    onPageAudit.hasAddon ||
    shareOfVoice.totalSnapshots > 0 ||
    shareOfVoice.topEntities.length > 0 ||
    competitorRollup.length > 0;

  const tabs: Array<{
    key: string;
    label: string;
    description?: string;
    content: React.ReactNode;
  }> = [
    {
      key: "opportunities",
      label: "Opportunities",
      description:
        "Keywords where the gap between AI demand and your AI presence is largest.",
      content: (
        <OpportunityScoreCard
          bare
          rows={opportunityScore.rows}
          engineSource={opportunityScore.engineSource}
        />
      ),
    },
    {
      key: "overview",
      label: "Overview citations",
      description:
        "Google AI Overview — where you're cited and where competitors are.",
      content: (
        <AiOverviewCard
          bare
          rows={aiOverview.rows}
          engineSource={aiOverview.engineSource}
        />
      ),
    },
    {
      key: "pageHealth",
      label: "Page health",
      description: "How ready your pages are to be cited by AI engines.",
      content: (
        <OnPageAuditCard
          bare
          hasAddon={onPageAudit.hasAddon}
          defaultUrl={onPageAudit.defaultUrl}
          latest={onPageAudit.latest}
          history={onPageAudit.history}
        />
      ),
    },
    {
      key: "sov",
      label: "Share of voice",
      description:
        "Your share of the AI conversation, and every rival the engines name.",
      content: (
        <ShareOfVoiceTab
          shareOfVoice={shareOfVoice}
          competitorRollup={competitorRollup}
        />
      ),
    },
  ];

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

      <VisibilityTrendCard trendWeeks={trendWeeks} trendDelta={kpis.trendDelta} />

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

      {/* Per-engine cards — directly under the KPI strip (Adam 2026-07-31:
          the four engine results are the most important glance after the
          headline KPIs). Each shows mention + citation rate per engine. */}
      <AeoEngineCards rows={engineCards} />

      <AiReferralCard aiReferral={aiReferral} />

      <CompetitorHeatmap rows={heatmapRows} />

      {/* What to do next — derived recommendations. */}
      <NextActions recs={recommendations} />

      {/* The actual AI prompts + responses. */}
      <div id="all-responses">
        <AeoResponsesTable rows={responses} />
      </div>

      {/* Operator-added prompts — run alongside the generated set. */}
      <AeoCustomPrompts
        properties={customPrompts.properties}
        prompts={customPrompts.prompts}
      />

      {/* AEO v2: deeper AI-search intelligence, consolidated into one
          tabbed card. All four tabs always render once any signal exists
          anywhere on the page — each card owns its own empty/gated state
          (see anyData comment above). If nothing has ever populated, a
          single activation banner replaces the whole card instead. */}
      {anyData ? (
        <TabbedCard
          title="AI search intelligence"
          tabs={tabs}
          minHeightClass="min-h-[280px]"
        />
      ) : (
        <SectionCard label="Deeper AI-search intelligence">
          <p className="text-[13px] text-muted-foreground py-2">
            {shareOfVoice.engineSource === "dataforseo"
              ? "Opportunities, AI Overview citations, page health, and share of voice populate after your next weekly scan."
              : "AI search intelligence is being activated for your account. Your first report lands within 24 hours."}
          </p>
        </SectionCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompetitorHeatmap (2026-08-14, slice 9 — Peec pattern). Rows = you +
// the top named competitors, cols = engines, cell = share of that
// engine's answers naming the row. Sequential single-hue fill (Carbon
// blue, alpha-stepped); the % is always printed so color never carries
// the value alone.
// ---------------------------------------------------------------------------

const HEATMAP_ENGINE_LABEL: Record<string, string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  CLAUDE: "Claude",
  GEMINI: "Gemini",
};

function heatCellStyle(pct: number | null): React.CSSProperties {
  if (pct === null) return { backgroundColor: "transparent" };
  // 5-step sequential alpha ramp on one hue.
  const alpha =
    pct === 0 ? 0.03 : pct < 0.25 ? 0.1 : pct < 0.5 ? 0.22 : pct < 0.75 ? 0.38 : 0.55;
  return { backgroundColor: `rgba(15, 98, 254, ${alpha})` };
}

function CompetitorHeatmap({
  rows,
}: {
  rows: AeoClientProps["heatmapRows"];
}) {
  // Needs you + at least one competitor with signal to be worth space.
  const competitorRows = rows.filter((r) => !r.isYou);
  if (
    rows.length < 2 ||
    competitorRows.every((r) => r.cells.every((c) => !c.pct))
  ) {
    return null;
  }
  const engines = rows[0]?.cells.map((c) => c.engine) ?? [];
  return (
    <SectionCard label="Who each engine prefers">
      <p className="mb-3 text-[12.5px] text-muted-foreground">
        Share of each engine&apos;s answers (30d) that name you vs the
        competitors AI brings up instead.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="py-1.5 pr-3 text-left font-medium text-muted-foreground" />
              {engines.map((e) => (
                <th
                  key={e}
                  className="px-2 py-1.5 text-center font-medium text-muted-foreground"
                >
                  {HEATMAP_ENGINE_LABEL[e] ?? e}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t border-border">
                <td
                  className={`max-w-[180px] truncate py-1.5 pr-3 ${
                    row.isYou ? "font-semibold text-foreground" : "text-foreground"
                  }`}
                  title={row.name}
                >
                  {row.name}
                </td>
                {row.cells.map((cell) => (
                  <td key={cell.engine} className="px-1 py-1">
                    <div
                      className="flex h-8 items-center justify-center tabular-nums"
                      style={{ ...heatCellStyle(cell.pct), borderRadius: 2 }}
                    >
                      {cell.pct === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        `${Math.round(cell.pct * 100)}%`
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// AiReferralCard (2026-08-14, slice 11) — the attribution proof chain.
// Visits from AI assistants (pixel referrer/utm) → leads → signed
// leases. Visibility tools stop at "you were mentioned"; this is the
// number that closes deals.
// ---------------------------------------------------------------------------

function AiReferralCard({
  aiReferral,
}: {
  aiReferral: AeoClientProps["aiReferral"];
}) {
  const { visits, leads, signed, byEngine, windowDays } = aiReferral;
  return (
    <SectionCard label="AI search → signed leases">
      {visits === 0 ? (
        <p className="text-[13px] text-muted-foreground py-1">
          No AI-referred visits detected in the last {windowDays} days.
          Renters arrive from ChatGPT, Perplexity, Gemini, and Copilot once
          the engines recommend you — the pixel attributes every one of
          those visits automatically.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {[
              { value: visits, label: `visits from AI assistants (${windowDays}d)` },
              { value: leads, label: "became leads" },
              { value: signed, label: "signed leases" },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 ? (
                  <ArrowRight
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden
                  />
                ) : null}
                <div>
                  <div className="text-xl font-semibold tabular-nums">
                    {fmtNumber(s.value)}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {s.label}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
          {byEngine.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {byEngine.map((e) => (
                <span
                  key={e.engine}
                  className="rounded-full border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground"
                >
                  {e.engine}{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {fmtNumber(e.visits)}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}

const TREND_ENGINE_OPTIONS = [
  { key: "ALL", label: "All engines" },
  { key: "CHATGPT", label: "ChatGPT" },
  { key: "PERPLEXITY", label: "Perplexity" },
  { key: "CLAUDE", label: "Claude" },
  { key: "GEMINI", label: "Gemini" },
] as const;

// VisibilityTrendCard (2026-08-14) — weekly mention-rate line above the
// stat cards. One hero number + arrow, engine-filterable. Weeks without
// a scan are skipped, never plotted as fake zeros.
function VisibilityTrendCard({
  trendWeeks,
  trendDelta,
}: {
  trendWeeks: TrendWeek[];
  trendDelta: number;
}) {
  const [engine, setEngine] = React.useState<string>("ALL");
  const points = trendWeeks
    .map((w) => ({
      label: w.label,
      value: engine === "ALL" ? w.overall : (w.byEngine[engine] ?? null),
    }))
    .filter((p): p is { label: string; value: number } => p.value !== null);

  if (points.length < 2) return null; // trend needs two scanned weeks

  const latest = points[points.length - 1].value;
  const delta =
    engine === "ALL" ? trendDelta : latest - points[0].value;
  const DeltaIcon =
    Math.abs(delta) < 0.005 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const deltaColor =
    Math.abs(delta) < 0.005
      ? "text-muted-foreground"
      : delta > 0
        ? "text-emerald-700"
        : "text-red-700";

  return (
    <SectionCard label="Visibility trend">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {fmtPercent(latest)}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[13px] font-medium ${deltaColor}`}
            >
              <DeltaIcon className="h-3.5 w-3.5" aria-hidden />
              {delta >= 0 ? "+" : ""}
              {(delta * 100).toFixed(0)} pts
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {engine === "ALL"
              ? "Share of AI answers naming you, weekly · vs prior 30 days"
              : `Share of ${TREND_ENGINE_OPTIONS.find((o) => o.key === engine)?.label} answers naming you · vs first scanned week`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {TREND_ENGINE_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setEngine(o.key)}
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium ${
                engine === o.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <Sparkline
          data={points.map((p) => p.value)}
          width={600}
          height={56}
          className="w-full"
        />
        <div className="mt-1 flex justify-between text-[10.5px] text-muted-foreground">
          <span>{points[0].label}</span>
          <span>{points[points.length - 1].label}</span>
        </div>
      </div>
    </SectionCard>
  );
}
