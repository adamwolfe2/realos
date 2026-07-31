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
// the right empty state depending on engine source.

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
  bare?: boolean;
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

// Single-hue sequential ramp (Carbon blue, dark→light in weight order) —
// one magnitude, one hue. Matches the portal's #0f62fe accent system
// instead of the old grayscale foreground mixes.
const COMPONENT_COLORS: Record<keyof OpportunityRow["breakdown"], string> = {
  aiVolumeBand: "#0f62fe",
  mentionGap: "color-mix(in srgb, #0f62fe 75%, white)",
  gscPotential: "color-mix(in srgb, #0f62fe 55%, white)",
  competitorPresence: "color-mix(in srgb, #0f62fe 38%, white)",
  onPageHealth: "color-mix(in srgb, #0f62fe 22%, white)",
};

function StackedBar({ row }: { row: OpportunityRow }) {
  // Each component contributes (value × weight) points out of 100.
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary"
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
            style={{ width: `${pct}%`, background: COMPONENT_COLORS[c.key] }}
            title={`${c.label}: ${pts.toFixed(1)} pts`}
          />
        );
      })}
    </div>
  );
}

// Legend for the stacked bar — the old bar shipped with zero explanation
// of what its segments meant.
function BreakdownLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2">
      {COMPONENT_LABELS.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: COMPONENT_COLORS[c.key] }}
          />
          {c.label} · {c.weight}pts
        </span>
      ))}
    </div>
  );
}

export function OpportunityScoreCard({
  rows,
  engineSource,
  bare = false,
}: OpportunityScoreProps) {
  return (
    <SectionCard
      bare={bare}
      label="AEO Opportunity Score"
      description="Keywords ranked by where the gap between AI demand and your AI presence is largest. Composite of AI volume, mention gap, GSC potential, competitor density, and OnPage health."
    >
      {rows.length === 0 ? (
        engineSource === "dataforseo" ? (
          <div className="text-[13px] text-muted-foreground py-2">
            Opportunity scores populate on your next scan. If none surface,
            connect Google Search Console from the{" "}
            <a
              href="/portal/connect"
              className="underline underline-offset-2"
            >
              Connect hub
            </a>{" "}
            so we can rank your real top queries.
          </div>
        ) : (
          <div className="text-[13px] text-muted-foreground py-2">
            AI search intelligence is being activated for your account. Your
            first opportunity ranking lands within 24 hours.
          </div>
        )
      ) : (
        <>
          {/* Context strip — plain-English read of what the list means,
              so the tab answers "so what?" before the operator parses rows. */}
          <div className="mb-3 rounded-[2px] border border-border bg-secondary px-3 py-2 text-[12px] text-foreground">
            <span className="font-semibold">
              {rows.length} keyword{rows.length === 1 ? "" : "s"} ranked.
            </span>{" "}
            Biggest gap: <span className="font-semibold">“{rows[0].keyword}”</span>{" "}
            (score {rows[0].score}/100) — high AI demand, low presence for you.
            Higher score = bigger win from publishing targeted content.
          </div>
        <ul className="divide-y divide-border">
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
              <div className="col-span-1 text-right">
                <span className="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded-[2px] bg-[#edf5ff] text-[#0f62fe] tabular-nums text-[13px] font-semibold">
                  {row.score}
                </span>
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
          <BreakdownLegend />
        </>
      )}
    </SectionCard>
  );
}
