"use client";

import * as React from "react";
import { GrowBar, StaggerGroup, StaggerItem } from "@/components/portal/ui/motion";
import { CHART_COLORS } from "@/components/portal/ui/chart-theme";

// ---------------------------------------------------------------------------
// StageFunnel — horizontal bar funnel for ordered pipeline stages. Shared by
// the dashboard's Pipeline strip (Visitors → Leads → Applications) and Lead
// journey (Leads → Applied → Approved → Signed) so both read as one visual
// language: bar length = magnitude, "→N%" = step-down conversion from the
// previous tracked stage — the drop-off is the story, so it's rendered, not
// implied. Brand rule: the monochromatic blue ramp (see lead-source-donut),
// darkest first stage, fixed order, never cycled.
// ---------------------------------------------------------------------------

export type StageFunnelStage = {
  label: string;
  value: number;
  /** Untracked stage — render "—", never a fake 0 bar. */
  notApplicable?: boolean;
  /** Precomputed step-down %; omit to compute from the previous stage. */
  conversionFromPrev?: number | null;
};

const RAMP = [
  CHART_COLORS.brandDeep, // Blue 80
  CHART_COLORS.brand, // Blue 60
  CHART_COLORS.brandSoft, // Blue 50
  CHART_COLORS.brandFog, // Blue 30
];

export function StageFunnel({ stages }: { stages: StageFunnelStage[] }) {
  if (stages.length === 0) return null;
  const max = Math.max(...stages.map((s) => (s.notApplicable ? 0 : s.value)), 1);

  return (
    <StaggerGroup as="ul" className="space-y-2.5">
      {stages.map((stage, i) => {
        const prev = i > 0 ? stages[i - 1] : null;
        const conversion =
          stage.conversionFromPrev !== undefined
            ? stage.conversionFromPrev
            : prev && !prev.notApplicable && !stage.notApplicable && prev.value > 0
              ? Math.round((stage.value / prev.value) * 100)
              : null;
        const width = stage.notApplicable
          ? 0
          : Math.max(stage.value > 0 ? 2 : 0, (stage.value / max) * 100);

        return (
          <StaggerItem as="li" index={i} key={stage.label} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="ls-eyebrow">{stage.label}</span>
              <span className="text-xs tabular-nums">
                <span className="font-semibold text-foreground">
                  {stage.notApplicable ? "—" : stage.value.toLocaleString()}
                </span>
                {i > 0 && conversion != null ? (
                  <span className="ml-1.5 font-mono text-muted-foreground">
                    →{conversion}%
                  </span>
                ) : null}
              </span>
            </div>
            <GrowBar
              percent={width}
              color={RAMP[Math.min(i, RAMP.length - 1)]}
              height={8}
              radius={0}
              trackColor="#f4f4f4"
              delay={0.05 + i * 0.06}
            />
          </StaggerItem>
        );
      })}
    </StaggerGroup>
  );
}
