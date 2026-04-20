import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// ConversionFunnel
//
// Stage-by-stage funnel: Visitors -> Engaged -> Lead -> Tour -> Application.
// Each row is a horizontal bar whose width is the stage's share of the top
// stage. Conversion percentage between rows lives in the right gutter so
// operators can spot the leakiest step at a glance.
// ---------------------------------------------------------------------------

export type FunnelStage = {
  label: string;
  value: number;
  // Drill-down link for the stage. Optional.
  href?: string;
};

export function ConversionFunnel({ stages }: { stages: FunnelStage[] }) {
  if (stages.length === 0) return null;
  const top = Math.max(1, stages[0].value);

  return (
    <ol className="space-y-2.5">
      {stages.map((s, i) => {
        const widthPct = Math.max(3, Math.round((s.value / top) * 100));
        const prev = i === 0 ? null : stages[i - 1].value;
        const conversion =
          prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-xs text-[var(--olive-gray)]">
              {s.label}
            </div>
            <div className="flex-1 relative h-7 rounded-md bg-[var(--warm-sand)]/60 overflow-hidden">
              <div
                className={cn(
                  "h-full flex items-center justify-end px-2 text-[11px] font-medium tabular-nums text-white transition-all duration-700",
                  i === 0
                    ? "bg-[var(--terracotta)]"
                    : "bg-[var(--terracotta)]/85",
                )}
                style={{ width: `${widthPct}%` }}
              >
                {widthPct >= 14 ? s.value.toLocaleString() : null}
              </div>
              {widthPct < 14 ? (
                <span className="absolute left-0 top-0 h-full px-2 flex items-center text-[11px] font-medium tabular-nums text-[var(--near-black)]">
                  {s.value.toLocaleString()}
                </span>
              ) : null}
            </div>
            <div className="w-14 text-right text-[11px] tabular-nums text-[var(--stone-gray)] shrink-0">
              {conversion != null ? `${conversion}%` : "—"}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
