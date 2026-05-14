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
  // rainbow effect across SEO + Attribution. Tone is now communicated via
  // delta chips and copy, not by painting the entire tile background.
  const toneClass =
    tone === "warn"
      ? "border-primary/40 bg-primary/[0.03]"
      : tone === "danger"
        ? "border-destructive/40 bg-destructive/[0.03]"
        : tone === "success"
          ? "border-primary/40 bg-primary/[0.03]"
          : "border-border bg-card";
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
