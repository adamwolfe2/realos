import * as React from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  tone,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "warn" | "success" | "danger";
  hint?: string;
  className?: string;
}) {
  // All StatCards now render on a neutral white surface. Earlier we tinted
  // success → emerald and danger → red, which produced the green/pink/cream
  // rainbow effect across SEO + Attribution — visible on the SEO page as a
  // peach wash behind every down-delta card. Tone is now communicated via
  // the delta chip in `hint` and the prefix copy, not by painting the
  // entire tile background. The `tone` prop is kept on the type so callers
  // don't need to be updated, but every value resolves to the same neutral
  // surface.
  void tone;
  const toneClass = "border-border bg-card";
  return (
    <div
      className={cn(
        // Premium-pass: rounded-xl + softer hover shadow + bumped padding
        // (p-3 → p-4) to match the dashboard KpiTile so the SEO and
        // Attribution stat strips read as the same product surface.
        "rounded-xl border p-4 transition-all hover:shadow-[0_2px_8px_rgba(15,23,42,0.04)]",
        toneClass,
        className,
      )}
    >
      <div className="text-[10px] tracking-[0.14em] uppercase font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="text-3xl font-semibold tracking-tight mt-2 tabular-nums text-foreground leading-none">
        {value}
      </div>
      {hint ? (
        <div className="text-[11px] text-muted-foreground mt-1.5">{hint}</div>
      ) : null}
    </div>
  );
}
