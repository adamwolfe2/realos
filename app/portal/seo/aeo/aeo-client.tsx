"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AeoScanButton } from "./aeo-scan-button";
import {
  AeoEngineCards,
  type EngineCardData,
} from "./aeo-engine-cards";
import {
  AeoResponsesTable,
  type ResponseRow,
} from "./aeo-responses-table";

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
    citationRate30: number;
    last30Cited: number;
    last30Total: number;
    priorRate: number;
    prior30Total: number;
    trendDelta: number;
    competitorsNamed: number;
  };
};

function fmtPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function fmtNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString();
}

export function AeoClient({
  engineCards,
  responses,
  competitorRollup,
  lastScanAt,
  kpis,
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

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Citation rate (30d)"
          value={fmtPercent(kpis.citationRate30)}
          hint={
            kpis.last30Total > 0
              ? `${kpis.last30Cited} of ${kpis.last30Total} queries cited you`
              : "No queries in window"
          }
        />
        <StatCard
          label="Citations (30d)"
          value={fmtNumber(kpis.last30Cited)}
          hint={`${fmtNumber(kpis.last30Total)} total queries`}
        />
        <StatCard
          label="Trend vs prior 30d"
          value={
            kpis.prior30Total === 0
              ? "—"
              : `${kpis.trendDelta >= 0 ? "+" : ""}${(kpis.trendDelta * 100).toFixed(0)}pp`
          }
          hint={
            kpis.prior30Total === 0
              ? "Need 60d of history"
              : `Prior period: ${fmtPercent(kpis.priorRate)}`
          }
        />
        <StatCard
          label="Competitors named"
          value={fmtNumber(kpis.competitorsNamed)}
          hint="Unique buildings surfaced when you weren't"
        />
      </div>

      {/* Per-engine cards */}
      <AeoEngineCards rows={engineCards} />

      {/* All Responses table */}
      <AeoResponsesTable rows={responses} />

      {/* Competitors rollup */}
      <SectionCard
        label="Competitors cited"
        description="Buildings surfaced when your properties weren't (last 30 days)."
      >
        {competitorRollup.length === 0 ? (
          <div className="text-[13px] text-muted-foreground py-2">
            No competitor names extracted yet.
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
                    href={`/portal/seo/agent?counter=${encodeURIComponent(name)}`}
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
