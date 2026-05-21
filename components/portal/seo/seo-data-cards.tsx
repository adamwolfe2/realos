import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  ExternalLink,
  Gauge,
  Link2,
  Minus,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// SEO data cards — pure server-component renderers fed by the parent
// /portal/seo/agent page.tsx. Each card handles its own empty + connected
// states so the page can compose them without conditional logic.
//
// All numeric formatting uses tabular-nums + clamp 0..100 so the layout
// stays stable as scores update.
// ---------------------------------------------------------------------------

const SUBTLE_BORDER = "border-border";

// ---------------------------------------------------------------------------
// Integration status row — GA4 / GSC / DataforSEO / AEO scanner chips
// ---------------------------------------------------------------------------

export type IntegrationState =
  | { connected: true; lastSyncAt: Date | null; detail?: string }
  | { connected: false; reason: string };

export function IntegrationStatusRow({
  integrations,
}: {
  integrations: Array<{
    label: string;
    icon: React.ReactNode;
    state: IntegrationState;
    connectHref?: string;
  }>;
}) {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {integrations.map((i) => {
        const connected = i.state.connected;
        return (
          <div
            key={i.label}
            className={`flex items-center gap-2.5 rounded-lg border ${SUBTLE_BORDER} bg-card px-3 py-2.5`}
          >
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0 ${
                connected
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.1em] text-muted-foreground leading-tight">
                {i.label}
              </p>
              <p
                className={`text-[12px] font-semibold leading-tight truncate ${
                  connected ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {connected
                  ? i.state.detail ?? "Connected"
                  : i.state.connected === false
                    ? i.state.reason
                    : ""}
              </p>
            </div>
            {!connected && i.connectHref ? (
              <a
                href={i.connectHref}
                className="text-[10.5px] font-semibold text-primary hover:underline shrink-0"
              >
                Connect
              </a>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Composite health card — single big number + pillar dots
// ---------------------------------------------------------------------------

export function HealthScoreCard({
  composite,
  pillars,
}: {
  composite: number | null;
  pillars: Array<{ label: string; value: number | null; max?: number }>;
}) {
  const score = composite ?? 0;
  const ringR = 28;
  const ringC = 2 * Math.PI * ringR;
  const dash = (score / 100) * ringC;
  const color =
    score >= 75 ? "#10B981" : score >= 50 ? "#2563EB" : score >= 25 ? "#F59E0B" : "#EF4444";

  return (
    <section
      className={`rounded-2xl border ${SUBTLE_BORDER} bg-card p-5 grid grid-cols-[auto_minmax(0,1fr)] gap-5 items-center`}
    >
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 64 64" className="absolute inset-0">
          <circle
            cx="32"
            cy="32"
            r={ringR}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="6"
          />
          <circle
            cx="32"
            cy="32"
            r={ringR}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${ringC}`}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-display font-medium tabular-nums leading-none"
            style={{ fontSize: 22 }}
          >
            {composite != null ? composite : "—"}
          </span>
          <span className="text-[8px] font-mono uppercase tracking-[0.1em] text-muted-foreground mt-0.5">
            /100
          </span>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-1">
          Health · composite
        </p>
        <h3 className="text-base font-semibold text-foreground leading-tight mb-2">
          {composite == null
            ? "Score appears after your first weekly scan."
            : score >= 75
              ? "Strong. Maintain momentum."
              : score >= 50
                ? "Healthy. Capacity to grow."
                : score >= 25
                  ? "Below benchmark. Several quick wins available."
                  : "Critical. Open the action items below."}
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {pillars.map((p) => (
            <div
              key={p.label}
              className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5"
            >
              <p className="text-[9px] font-mono uppercase tracking-[0.08em] text-muted-foreground leading-tight">
                {p.label}
              </p>
              <p className="text-[12px] font-semibold text-foreground tabular-nums leading-tight">
                {p.value != null ? Math.round(p.value) : "—"}
                {p.max ? (
                  <span className="text-[9px] font-mono text-muted-foreground ml-0.5">
                    / {p.max}
                  </span>
                ) : null}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SERP rankings table — current rank per target query
// ---------------------------------------------------------------------------

export type SerpRow = {
  query: string;
  ourRank: number | null;
  ourUrl: string | null;
  topResults: Array<{
    rank: number;
    domain: string;
    title: string;
    url: string;
  }>;
  delta?: number | null; // change vs prior scan, null if none
};

export function SerpRankingsCard({
  rows,
  totalQueries,
}: {
  rows: SerpRow[];
  totalQueries: number;
}) {
  return (
    <section className={`rounded-2xl border ${SUBTLE_BORDER} bg-card overflow-hidden`}>
      <header className="flex items-baseline justify-between gap-3 px-5 py-3 border-b border-border">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-0.5">
            SERP rankings · live
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            Where you rank on Google right now
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {rows.length} of {totalQueries} queries
        </span>
      </header>
      {rows.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-8 text-center px-5">
          Rankings appear after the first DataforSEO scan completes.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const inTop10 = r.ourRank != null && r.ourRank <= 10;
            const inTop3 = r.ourRank != null && r.ourRank <= 3;
            return (
              <li
                key={r.query}
                className="grid grid-cols-[1fr_72px_120px] items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">
                    "{r.query}"
                  </p>
                  {r.ourUrl ? (
                    <a
                      href={r.ourUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10.5px] text-muted-foreground hover:text-primary truncate inline-flex items-center gap-1"
                    >
                      {r.ourUrl.replace(/^https?:\/\//, "").slice(0, 60)}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : r.topResults[0] ? (
                    <p className="text-[10.5px] text-muted-foreground truncate">
                      Top result: {r.topResults[0].domain}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  {r.ourRank == null ? (
                    <span className="text-[11px] text-muted-foreground">
                      Not in top 100
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 text-[15px] font-display font-semibold tabular-nums ${
                        inTop3
                          ? "text-primary font-bold"
                          : inTop10
                            ? "text-primary"
                            : "text-foreground"
                      }`}
                    >
                      #{r.ourRank}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  {r.delta == null || r.delta === 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
                      <Minus className="h-2.5 w-2.5" />
                      No change
                    </span>
                  ) : r.delta > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] text-primary font-semibold">
                      <ArrowUp className="h-2.5 w-2.5" />
                      Up {r.delta}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10.5px] text-destructive font-semibold">
                      <ArrowDown className="h-2.5 w-2.5" />
                      Down {Math.abs(r.delta)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Lighthouse + Core Web Vitals
// ---------------------------------------------------------------------------

export function LighthouseCard({
  scores,
  vitals,
  url,
}: {
  scores: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
    pwa: number | null;
  };
  vitals: {
    fcpMs: number | null;
    lcpMs: number | null;
    cls: number | null;
    tbtMs: number | null;
  };
  url: string | null;
}) {
  const pillars = [
    { label: "Performance", value: scores.performance },
    { label: "Accessibility", value: scores.accessibility },
    { label: "Best practices", value: scores.bestPractices },
    { label: "SEO", value: scores.seo },
    { label: "PWA", value: scores.pwa },
  ];
  return (
    <section className={`rounded-2xl border ${SUBTLE_BORDER} bg-card p-5`}>
      <header className="flex items-baseline justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-0.5">
            Lighthouse · audit
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            Technical health
          </h3>
        </div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-muted-foreground hover:text-primary truncate inline-flex items-center gap-1"
          >
            {url.replace(/^https?:\/\//, "").slice(0, 36)}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : null}
      </header>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {pillars.map((p) => (
          <ScoreDot key={p.label} label={p.label} value={p.value} />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-border/60">
        <VitalCell label="FCP" value={vitals.fcpMs} unit="ms" goodMax={1800} />
        <VitalCell label="LCP" value={vitals.lcpMs} unit="ms" goodMax={2500} />
        <VitalCell
          label="CLS"
          value={vitals.cls}
          unit=""
          decimals={2}
          goodMax={0.1}
        />
        <VitalCell label="TBT" value={vitals.tbtMs} unit="ms" goodMax={200} />
      </div>
    </section>
  );
}

function ScoreDot({ label, value }: { label: string; value: number | null }) {
  const score = value != null ? Math.round(value * 100) / 100 : null;
  const display =
    score == null ? "—" : score <= 1 ? Math.round(score * 100) : Math.round(score);
  const numeric = typeof display === "number" ? display : 0;
  const color =
    numeric >= 90
      ? "#10B981"
      : numeric >= 70
        ? "#2563EB"
        : numeric >= 50
          ? "#F59E0B"
          : "#EF4444";
  const ringR = 18;
  const ringC = 2 * Math.PI * ringR;
  const dash = (numeric / 100) * ringC;
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative h-12 w-12 mb-1">
        <svg viewBox="0 0 40 40" className="absolute inset-0">
          <circle
            cx="20"
            cy="20"
            r={ringR}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="4"
          />
          <circle
            cx="20"
            cy="20"
            r={ringR}
            fill="none"
            stroke={score == null ? "hsl(var(--muted))" : color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${score == null ? 0 : dash} ${ringC}`}
            transform="rotate(-90 20 20)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-display font-semibold tabular-nums"
            style={{ fontSize: 13 }}
          >
            {display}
          </span>
        </div>
      </div>
      <p className="text-[9.5px] font-mono uppercase tracking-[0.08em] text-muted-foreground leading-tight">
        {label}
      </p>
    </div>
  );
}

function VitalCell({
  label,
  value,
  unit,
  goodMax,
  decimals,
}: {
  label: string;
  value: number | null;
  unit: string;
  goodMax: number;
  decimals?: number;
}) {
  const ok = value != null && value <= goodMax;
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5">
      <p className="text-[9.5px] font-mono uppercase tracking-[0.08em] text-muted-foreground leading-tight">
        {label}
      </p>
      <p
        className={`text-[13px] font-semibold tabular-nums leading-tight ${
          value == null
            ? "text-muted-foreground"
            : ok
              ? "text-primary"
              : "text-destructive"
        }`}
      >
        {value == null
          ? "—"
          : `${decimals ? value.toFixed(decimals) : Math.round(value)}${unit}`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backlinks summary + top competitors
// ---------------------------------------------------------------------------

export function BacklinksCard({
  summary,
}: {
  summary: {
    target: string;
    domainRank: number | null;
    backlinks: number;
    referringDomains: number;
    referringMainDomains: number;
  } | null;
}) {
  if (!summary) {
    return (
      <section className={`rounded-2xl border ${SUBTLE_BORDER} bg-card p-5`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-1">
              Backlinks
            </p>
            <h3 className="text-sm font-semibold text-foreground">
              Available on DataforSEO Plus
            </h3>
            <p className="text-[11.5px] text-muted-foreground mt-1.5 leading-snug max-w-md">
              Backlink coverage (domain rank, referring domains, link velocity)
              is gated to DataforSEO Plus and above. All other SEO signals —
              SERP rankings, Lighthouse, on-page audit, ranked keywords,
              competitor scan — are tracked on every plan and refresh nightly.
            </p>
          </div>
          {/* Plan-gated chip so the operator sees this is a paid-tier
              feature, not a broken integration. */}
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap shrink-0">
            Add-on
          </span>
        </div>
      </section>
    );
  }
  return (
    <section className={`rounded-2xl border ${SUBTLE_BORDER} bg-card p-5`}>
      <header className="mb-3">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-0.5">
          Backlinks · {summary.target}
        </p>
        <h3 className="text-sm font-semibold text-foreground">
          Domain authority
        </h3>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat
          label="Domain rank"
          value={summary.domainRank}
          max={1000}
        />
        <Stat label="Backlinks" value={summary.backlinks} />
        <Stat label="Ref. domains" value={summary.referringDomains} />
        <Stat label="Main ref." value={summary.referringMainDomains} />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  max,
}: {
  label: string;
  value: number | null;
  max?: number;
}) {
  return (
    <div>
      <p className="text-[9.5px] font-mono uppercase tracking-[0.08em] text-muted-foreground leading-tight">
        {label}
      </p>
      <p className="text-[18px] font-display font-medium tabular-nums leading-tight text-foreground">
        {value != null ? value.toLocaleString() : "—"}
        {max ? (
          <span className="text-[10px] font-mono text-muted-foreground ml-1">
            / {max.toLocaleString()}
          </span>
        ) : null}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top competitors (Google Places nearby + DataforSEO organic)
// ---------------------------------------------------------------------------

export type CompetitorRow = {
  name: string;
  source: "GOOGLE_PLACES_NEARBY" | "DATAFORSEO_COMPETITORS_DOMAIN" | "YELP_FUSION_NEARBY";
  url: string | null;
  distanceMeters: number | null;
  rating: number | null;
  reviewCount: number | null;
  intersections?: number; // for DataforSEO competitors
};

export function CompetitorsCard({ rows }: { rows: CompetitorRow[] }) {
  return (
    <section className={`rounded-2xl border ${SUBTLE_BORDER} bg-card overflow-hidden`}>
      <header className="px-5 py-3 border-b border-border">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-0.5">
          Competitors
        </p>
        <h3 className="text-sm font-semibold text-foreground">
          Who's ranking and reviewing near you
        </h3>
      </header>
      {rows.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-8 text-center px-5">
          Competitors appear after the nightly scan or your first scan
          completes.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.slice(0, 8).map((c, i) => (
            <li
              key={`${c.source}-${c.name}-${i}`}
              className="grid grid-cols-[1fr_72px_72px] items-center gap-3 px-5 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate">
                  {c.name}
                </p>
                <p className="text-[10.5px] text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
                  {c.source === "GOOGLE_PLACES_NEARBY" ? "Nearby" : "Organic overlap"}
                  {c.distanceMeters != null ? (
                    <>
                      <span aria-hidden>·</span>
                      {(c.distanceMeters / 1609).toFixed(1)} mi
                    </>
                  ) : null}
                  {c.intersections != null ? (
                    <>
                      <span aria-hidden>·</span>
                      {c.intersections} shared kw
                    </>
                  ) : null}
                </p>
              </div>
              <div className="text-right">
                {c.rating != null ? (
                  <span className="inline-flex items-center gap-1 text-[12px] tabular-nums text-foreground">
                    {c.rating.toFixed(1)}★
                  </span>
                ) : (
                  <span className="text-[10.5px] text-muted-foreground">—</span>
                )}
              </div>
              <div className="text-right">
                {c.reviewCount != null ? (
                  <span className="text-[10.5px] text-muted-foreground tabular-nums">
                    {c.reviewCount.toLocaleString()} reviews
                  </span>
                ) : (
                  <span className="text-[10.5px] text-muted-foreground">—</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// AEO citation summary
// ---------------------------------------------------------------------------

export function AeoCard({
  citationRate,
  cited,
  notCited,
  competitorCited,
  totalChecks,
}: {
  citationRate: number; // 0..1
  cited: number;
  notCited: number;
  competitorCited: number;
  totalChecks: number;
}) {
  return (
    <section className={`rounded-2xl border ${SUBTLE_BORDER} bg-card p-5`}>
      <header className="mb-3">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-0.5">
          AEO · AI search visibility
        </p>
        <h3 className="text-sm font-semibold text-foreground">
          ChatGPT, Perplexity, Claude, Gemini
        </h3>
      </header>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <p className="text-[9.5px] font-mono uppercase tracking-[0.08em] text-muted-foreground leading-tight">
            Citation rate
          </p>
          <p className="text-[20px] font-display font-medium tabular-nums leading-tight text-foreground">
            {totalChecks > 0 ? `${Math.round(citationRate * 100)}%` : "—"}
          </p>
        </div>
        <Stat label="You cited" value={cited} />
        <Stat label="Competitor" value={competitorCited} />
        <Stat label="Nobody" value={notCited} />
      </div>
    </section>
  );
}
