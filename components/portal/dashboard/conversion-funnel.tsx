import * as React from "react";
import { cn } from "@/lib/utils";

export type FunnelStage = {
  label: string;
  value: number;
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
            <div className="w-24 shrink-0 text-xs text-muted-foreground">
              {s.label}
            </div>
            <div className="flex-1 relative h-7 rounded-md bg-muted/50 overflow-hidden">
              <div
                className={cn(
                  "h-full flex items-center justify-end px-2 text-[11px] font-medium tabular-nums text-white transition-all duration-700",
                  i === 0 ? "bg-primary" : "bg-primary/80",
                )}
                style={{ width: `${widthPct}%` }}
              >
                {widthPct >= 14 ? s.value.toLocaleString() : null}
              </div>
              {widthPct < 14 ? (
                <span className="absolute left-0 top-0 h-full px-2 flex items-center text-[11px] font-medium tabular-nums text-foreground">
                  {s.value.toLocaleString()}
                </span>
              ) : null}
            </div>
            <div className="w-14 text-right text-[11px] tabular-nums text-muted-foreground shrink-0">
              {conversion != null ? `${conversion}%` : "—"}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
