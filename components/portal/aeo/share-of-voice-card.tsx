"use client";

import * as React from "react";
import { SectionCard } from "@/components/admin/page-header";
import type { AeoEngine } from "@prisma/client";

// AEO v2 W1: "AI Share of Voice" widget. Aggregates AeoMentionSnapshot
// rows (last 30 days) into a per-engine SoV percentage + a top-entities
// rollup. Renders inside the existing AEO surface; honors the design
// system (Newsreader headings via SectionCard parent, no emojis, no
// dark-mode classes, no colored badges).

export type ShareOfVoicePerEngine = {
  engine: AeoEngine;
  /// Average share-of-voice across all snapshots in window, 0.0-1.0.
  avgSov: number;
  /// Number of snapshots aggregated (sample size hint for operators).
  snapshotCount: number;
};

export type TopEntity = {
  name: string;
  kind: "self" | "competitor" | "other";
  count: number;
};

export type ShareOfVoiceProps = {
  perEngine: ShareOfVoicePerEngine[];
  topEntities: TopEntity[];
  /// Overall snapshot count across all engines. Drives the empty state.
  totalSnapshots: number;
  /// Engine source from AEO_ENGINE_SOURCE — drives empty-state copy so
  /// direct-mode operators see "requires DataForSEO" instead of the
  /// generic "after the next scan" message that never resolves on direct.
  engineSource: "direct" | "dataforseo";
};

function fmtPercent(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(0)}%`;
}

function engineLabel(e: AeoEngine): string {
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

export function ShareOfVoiceCard({
  perEngine,
  topEntities,
  totalSnapshots,
  engineSource,
}: ShareOfVoiceProps) {
  const maxSov = perEngine.reduce(
    (m, row) => (row.avgSov > m ? row.avgSov : m),
    0,
  );
  // Bars normalize to the visible max so 0.0-0.1 SoV doesn't render as
  // invisible slivers. Floor at 5% width so even tiny non-zero slices
  // remain perceptible.
  function barWidth(v: number): string {
    if (maxSov <= 0) return "0%";
    const ratio = v / maxSov;
    if (ratio <= 0) return "0%";
    return `${Math.max(ratio * 100, 5)}%`;
  }

  return (
    <SectionCard
      label="AI Share of Voice"
      description="What fraction of named entities in AI answers are you (vs. competing buildings) — averaged across the last 30 days of scans. Sourced from DataForSEO AI Optimization."
    >
      {totalSnapshots === 0 ? (
        engineSource === "dataforseo" ? (
          <div className="text-[13px] text-muted-foreground py-2">
            Share of voice will populate after the next AEO scan.
          </div>
        ) : (
          <div className="text-[13px] text-muted-foreground py-2 space-y-1">
            <div>
              Share of voice requires the DataForSEO LLM Responses adapter,
              which is off by default.
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Per-engine SoV bars */}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">
              Per engine (30d avg)
            </div>
            <ul className="space-y-2.5">
              {perEngine.map((row) => (
                <li key={row.engine} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="text-foreground">
                      {engineLabel(row.engine)}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {fmtPercent(row.avgSov)}
                      <span className="text-[10px] ml-2 text-muted-foreground/70">
                        n={row.snapshotCount}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--hair)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground/80"
                      style={{ width: barWidth(row.avgSov) }}
                      aria-hidden
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Top entities */}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">
              Top entities mentioned (30d)
            </div>
            {topEntities.length === 0 ? (
              <div className="text-[13px] text-muted-foreground">
                No entities classified yet.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {topEntities.slice(0, 8).map((e) => (
                  <li
                    key={`${e.name}-${e.kind}`}
                    className="flex items-center justify-between gap-2 text-[13px] border-b border-[var(--hair)] last:border-b-0 py-1.5"
                  >
                    <span className="truncate text-foreground" title={e.name}>
                      {e.name}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {e.kind === "self"
                          ? "You"
                          : e.kind === "competitor"
                            ? "Competitor"
                            : "Other"}
                      </span>
                      <span className="tabular-nums text-[11px] text-muted-foreground">
                        {e.count}×
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
