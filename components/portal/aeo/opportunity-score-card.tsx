"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { SectionCard } from "@/components/admin/page-header";

// AEO v2 W2: AEO Opportunity Score widget. Top-N keywords ranked by the
// composite 0-100 score, with a per-row stacked bar showing how the five
// components contributed. Each row links to /portal/content/new prefilled
// with the keyword so the operator can act in one click.
//
// Empty state branches on engineSource so direct-mode tenants see the
// "needs DataForSEO" copy instead of the never-resolving "after next scan".

export type OpportunityRow = {
  keyword: string;
  score: number;
  gscClicks28d: number;
  gscImpressions28d: number;
  aiSearchVolume: number;
  yourMentionCount: number;
  competitorMentionCount: number;
  /// 0-1 per-component contributions in the SAME unit order the formula
  /// uses. Driven by computeOpportunityScore.breakdown server-side.
  breakdown: {
    aiVolumeBand: number;
    mentionGap: number;
    gscPotential: number;
    competitorPresence: number;
    onPageHealth: number;
  };
};

export type OpportunityScoreProps = {
  rows: OpportunityRow[];
  engineSource: "direct" | "dataforseo";
};

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString();
}

const COMPONENT_LABELS: Array<{
  key: keyof OpportunityRow["breakdown"];
  label: string;
  weight: number;
}> = [
  { key: "aiVolumeBand", label: "AI volume", weight: 30 },
  { key: "mentionGap", label: "Mention gap", weight: 25 },
  { key: "gscPotential", label: "GSC potential", weight: 20 },
  { key: "competitorPresence", label: "Competitors", weight: 15 },
  { key: "onPageHealth", label: "OnPage", weight: 10 },
];

function StackedBar({ row }: { row: OpportunityRow }) {
  // Each component contributes (value × weight) points out of 100.
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--hair)]"
      aria-label={`Score breakdown: ${row.score} of 100`}
    >
      {COMPONENT_LABELS.map((c) => {
        const pts = row.breakdown[c.key] * c.weight;
        const pct = (pts / 100) * 100;
        if (pct <= 0) return null;
        return (
          <div
            key={c.key}
            className="h-full"
            style={{
              width: `${pct}%`,
              background:
                c.key === "aiVolumeBand"
                  ? "var(--foreground)"
                  : c.key === "mentionGap"
                    ? "color-mix(in srgb, var(--foreground) 75%, transparent)"
                    : c.key === "gscPotential"
                      ? "color-mix(in srgb, var(--foreground) 55%, transparent)"
                      : c.key === "competitorPresence"
                        ? "color-mix(in srgb, var(--foreground) 35%, transparent)"
                        : "color-mix(in srgb, var(--foreground) 20%, transparent)",
            }}
            title={`${c.label}: ${pts.toFixed(1)} pts`}
          />
        );
      })}
    </div>
  );
}

export function OpportunityScoreCard({
  rows,
  engineSource,
}: OpportunityScoreProps) {
  return (
    <SectionCard
      label="AEO Opportunity Score"
      description="Keywords ranked by where the gap between AI demand and your AI presence is largest. Composite of AI volume, mention gap, GSC potential, competitor density, and OnPage health."
    >
      {rows.length === 0 ? (
        engineSource === "dataforseo" ? (
          <div className="text-[13px] text-muted-foreground py-2">
            Opportunity scores compute on the next AEO scan with GSC data
            present. Connect Google Search Console under{" "}
            <a
              href="/portal/settings/integrations"
              className="underline underline-offset-2"
            >
              Settings → Integrations
            </a>{" "}
            if no top queries surface.
          </div>
        ) : (
          <div className="text-[13px] text-muted-foreground py-2 space-y-1">
            <div>
              Opportunity Score requires the DataForSEO AI Optimization
              adapter.
            </div>
            <div className="text-[12px] text-muted-foreground/80">
              Operator action: set{" "}
              <code className="px-1 py-0.5 bg-[var(--hair)] rounded text-[11px]">
                AEO_ENGINE_SOURCE=dataforseo
              </code>{" "}
              in Vercel and re-run a scan.
            </div>
          </div>
        )
      ) : (
        <ul className="divide-y divide-[var(--hair)]">
          {rows.slice(0, 10).map((row) => (
            <li
              key={row.keyword}
              className="py-3 grid grid-cols-12 gap-3 items-center"
            >
              <div className="col-span-5 min-w-0">
                <div
                  className="truncate text-[14px] text-foreground"
                  title={row.keyword}
                >
                  {row.keyword}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                  {fmtNum(row.gscClicks28d)} clicks · {fmtNum(row.gscImpressions28d)}{" "}
                  imp · {fmtNum(row.aiSearchVolume)} AI vol ·{" "}
                  {row.yourMentionCount}/{row.yourMentionCount + row.competitorMentionCount}{" "}
                  mentioned
                </div>
              </div>
              <div className="col-span-5">
                <StackedBar row={row} />
              </div>
              <div className="col-span-1 text-right tabular-nums text-[14px] text-foreground font-semibold">
                {row.score}
              </div>
              <div className="col-span-1 text-right">
                <a
                  href={`/portal/content/new?format=BLOG_POST&target=${encodeURIComponent(row.keyword)}`}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                  title={`Draft a counter page for "${row.keyword}"`}
                >
                  Draft
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
