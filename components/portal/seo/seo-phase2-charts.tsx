"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyStateBody } from "./charts/shared";

// ---------------------------------------------------------------------------
// SEO Phase 2 chart pack — operator-facing visualizations sourced from
// the QueryLandingDaily + RankedKeyword + KeywordIntersection tables.
//
// Color system: brand-blue ramp for "you," neutral grays for context,
// semantic green / red ONLY for week-over-week deltas. Matches the
// brand cohesion rule in CLAUDE.md.
// ---------------------------------------------------------------------------

const BRAND = "#0f62fe";
const BRAND_LIGHT = "#93C5FD";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const SUCCESS = "#059669";
const DANGER = "#DC2626";
const BORDER = "#E2E8F0";

// ============================================================================
// EMPTY-STATE PREVIEW ILLUSTRATIONS (faded mini SVG charts)
// ============================================================================

function StrikingDistancePreview() {
  // Three faded sample rows — query, position pill, impressions bar.
  const rows = [
    { q: "section 8 housing nyc", pos: 7, imps: 78 },
    { q: "tenant background check", pos: 11, imps: 56 },
    { q: "rental listing software", pos: 14, imps: 38 },
  ];
  return (
    <svg viewBox="0 0 160 92" className="w-full h-auto" role="img" aria-hidden="true">
      {rows.map((r, i) => {
        const y = 12 + i * 26;
        return (
          <g key={i} opacity="0.75">
            <text x="4" y={y + 4} fontSize="6" fontFamily="var(--font-mono)" fill={INK}>
              {r.q}
            </text>
            <rect x="92" y={y - 4} width="14" height="10" rx="2" fill={BRAND} fillOpacity="0.18" />
            <text x="99" y={y + 3} fontSize="6" fontFamily="var(--font-mono)" fill={BRAND} textAnchor="middle">
              #{r.pos}
            </text>
            <rect x="114" y={y - 3} width={r.imps * 0.5} height="8" rx="2" fill={BRAND_LIGHT} fillOpacity="0.65" />
            <rect x="114" y={y - 3} width="40" height="8" rx="2" fill="none" stroke={BORDER} />
          </g>
        );
      })}
      <line x1="0" y1="86" x2="160" y2="86" stroke={BORDER} strokeDasharray="2 3" />
    </svg>
  );
}

// ============================================================================
// EXECUTIVE SUMMARY ROW
// ============================================================================

export type ExecSummaryStat = {
  label: string;
  value: string;
  /** Numeric delta (positive = improvement); null when no prior period. */
  delta: number | null;
  /** Render delta as percent (true) or absolute (false). */
  deltaPct?: boolean;
  /** For metrics where "lower is better" (cost, position) — flips color. */
  inverted?: boolean;
  hint?: string;
  /** Plain-English one-liner of what this number means, for non-SEO readers. */
  sublabel?: string;
  /** Benchmark state vs a sensible threshold; renders a good/ok/bad dot. */
  tone?: "good" | "ok" | "bad";
  /** When the source isn't connected, show this + a fix link instead of "—". */
  notConnected?: { label: string; href: string };
};

const TONE_DOT: Record<"good" | "ok" | "bad", string> = {
  good: "#10B981",
  ok: "#F59E0B",
  bad: "#EF4444",
};

export function ExecSummaryRow({ stats }: { stats: ExecSummaryStat[] }) {
  return (
    <section className="ls-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border/60 bg-gradient-to-r from-primary/[0.04] via-card to-card">
        <p className="ls-eyebrow ls-eyebrow-accent">
          Executive summary
        </p>
        <p className="ls-eyebrow">
          vs prior period
        </p>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border/60">
        {stats.map((s) => {
          const showDelta = s.delta != null;
          const positive = showDelta && (s.inverted ? s.delta! < 0 : s.delta! > 0);
          const negative = showDelta && (s.inverted ? s.delta! > 0 : s.delta! < 0);
          const flat = showDelta && s.delta === 0;
          const color = positive
            ? SUCCESS
            : negative
              ? DANGER
              : MUTED;
          const sign = showDelta && s.delta! > 0 ? "+" : "";
          const isMissing = s.value === "—" && s.notConnected;
          return (
            <div key={s.label} className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                {s.tone ? (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: TONE_DOT[s.tone] }}
                    aria-hidden="true"
                  />
                ) : null}
                <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-muted-foreground leading-tight">
                  {s.label}
                </p>
              </div>
              <p className="mt-0.5 text-[20px] ls-metric leading-none">
                {s.value}
              </p>
              {isMissing ? (
                <a
                  href={s.notConnected!.href}
                  className="mt-1.5 inline-block text-[10px] font-medium text-primary hover:underline leading-tight"
                >
                  {s.notConnected!.label} →
                </a>
              ) : showDelta ? (
                <p
                  className="mt-1.5 text-[11px] font-medium tabular-nums leading-none"
                  style={{ color }}
                >
                  {flat ? "Flat" : `${sign}${s.deltaPct ? `${s.delta!.toFixed(1)}%` : s.delta!.toLocaleString()}`}
                </p>
              ) : null}
              {s.sublabel ? (
                <p className="mt-1.5 text-[10px] text-muted-foreground leading-snug">
                  {s.sublabel}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================================
// RANGE SELECTOR (7d / 28d / 90d / 12mo)
// ============================================================================

export type RangeKey = "7d" | "28d" | "90d" | "12mo";

export function RangeSelector({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
}) {
  const opts: Array<{ k: RangeKey; label: string }> = [
    { k: "7d", label: "7 days" },
    { k: "28d", label: "28 days" },
    { k: "90d", label: "90 days" },
    { k: "12mo", label: "12 months" },
  ];
  return (
    <div className="inline-flex items-center rounded-[2px] border border-border bg-card p-0.5">
      {opts.map((o) => {
        const active = o.k === value;
        return (
          <button
            key={o.k}
            type="button"
            onClick={() => onChange(o.k)}
            className={`px-3 py-1 text-[11.5px] font-semibold rounded-[2px] transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// RangeSelector wired to the ?range= URL param (RISK-055). Reads the
// active value from the current URL and pushes the rest of the query
// string forward unchanged (propertyId, etc.) on change.
export function RangeSelectorBar({ value }: { value: RangeKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(next: RangeKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    router.push(`/portal/seo/agent?${params.toString()}`);
  }

  return <RangeSelector value={value} onChange={onChange} />;
}

// ============================================================================
// STRIKING DISTANCE TABLE (positions 4–20, high impressions)
// ============================================================================

export type StrikingDistanceRow = {
  query: string;
  url: string | null;
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
};

export function StrikingDistanceTable({
  rows,
  bare = false,
}: {
  rows: StrikingDistanceRow[];
  bare?: boolean;
}) {
  const sidePad = bare ? "px-0" : "px-5";
  return (
    <section
      className={
        bare
          ? "overflow-hidden"
          : "ls-card overflow-hidden"
      }
    >
      <header
        className={`flex items-baseline justify-between gap-3 ${sidePad} py-3 border-b border-border bg-gradient-to-r from-primary/[0.04] via-card to-card`}
      >
        <div>
          <p className="ls-eyebrow ls-eyebrow-accent">
            Striking distance
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            Queries ranking #4–20 with real impressions
          </h3>
        </div>
        <span className="text-[10.5px] text-muted-foreground tabular-nums">
          {rows.length} opportunities
        </span>
      </header>
      {rows.length === 0 ? (
        <div className={`${sidePad} py-5`}>
          <EmptyStateBody
            preview={<StrikingDistancePreview />}
            body="A ranked list of queries already showing in positions #4–20 with real impression volume — the closest-to-the-money keywords. Each row links to the URL ranking for it, so you know exactly which page to optimize first."
            example={`"section 8 housing nyc" at #7 with 4,200 monthly impressions and 1.4% CTR is a clean target — a meta refresh + one internal link is usually worth +2 positions and ~80 clicks/month.`}
          />
        </div>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[9.5px] font-mono uppercase tracking-[0.08em] text-muted-foreground border-b border-border/60">
              <th className={`${sidePad} py-2 font-semibold`}>Query</th>
              <th className="px-3 py-2 font-semibold text-right">Position</th>
              <th className="px-3 py-2 font-semibold text-right">Impressions</th>
              <th className="px-3 py-2 font-semibold text-right">Clicks</th>
              <th className="px-3 py-2 font-semibold text-right">CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((r, i) => (
              <tr
                key={`${r.query}-${i}`}
                className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <td className={`${sidePad} py-2 min-w-0`}>
                  <p className="font-medium text-foreground truncate max-w-[260px]">
                    {r.query}
                  </p>
                  {r.url ? (
                    <p className="text-[10px] text-muted-foreground truncate max-w-[260px]">
                      {r.url.replace(/^https?:\/\//, "")}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  #{r.position}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {r.impressions.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {r.clicks.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {(r.ctr * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ============================================================================
// LOCAL PACK TRACKER
// ============================================================================

export type LocalPackRow = {
  query: string;
  ourPosition: number | null;
  topResults: Array<{ position: number; title: string; rating: number | null; reviewCount: number }>;
};

export function LocalPackCard({
  rows,
  bare = false,
}: {
  rows: LocalPackRow[];
  bare?: boolean;
}) {
  const sidePad = bare ? "px-0" : "px-5";
  if (rows.length === 0) {
    return (
      <section className={bare ? "" : "ls-card p-5"}>
        <SectionHeader
          eyebrow="Google Maps"
          title="Local pack tracker"
        />
        <p className="text-[12px] text-muted-foreground py-8 text-center">
          Available after the first DataforSEO sync (local pack queries).
        </p>
      </section>
    );
  }
  return (
    <section
      className={
        bare ? "overflow-hidden" : "ls-card overflow-hidden"
      }
    >
      <header className={`${sidePad} py-3 border-b border-border`}>
        <p className="ls-eyebrow ls-eyebrow-accent">
          Google Maps
        </p>
        <h3 className="text-sm font-semibold text-foreground">
          Local pack tracker
        </h3>
      </header>
      <ul className="divide-y divide-border">
        {rows.slice(0, 6).map((r) => (
          <li
            key={r.query}
            className={`grid grid-cols-[1fr_72px_120px] items-center gap-3 ${sidePad} py-2.5`}
          >
            <p className="text-[12.5px] font-medium text-foreground truncate">
              "{r.query}"
            </p>
            <div className="text-right">
              {r.ourPosition == null ? (
                <span className="text-[10.5px] text-muted-foreground">
                  Not in pack
                </span>
              ) : (
                <span
                  className={`text-[14px] font-display font-semibold tabular-nums ${
                    r.ourPosition === 1 ? "text-primary font-bold" : "text-primary"
                  }`}
                >
                  #{r.ourPosition}
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-muted-foreground truncate text-right">
              Top: {r.topResults[0]?.title ?? "—"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ============================================================================
// Shared section header
// ============================================================================

function SectionHeader({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
}) {
  return (
    <header className="mb-3">
      <p className="ls-eyebrow ls-eyebrow-accent mb-0.5">
        {eyebrow}
      </p>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint ? (
        <p className="text-[10.5px] text-muted-foreground mt-0.5">{hint}</p>
      ) : null}
    </header>
  );
}
