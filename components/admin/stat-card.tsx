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
        "rounded-lg border p-3 transition-shadow duration-150 hover:shadow-sm",
        toneClass,
        className,
      )}
    >
      <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="text-xl font-semibold tracking-tight mt-1.5 tabular-nums text-foreground leading-none">
        {value}
      </div>
      {hint ? (
        <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>
      ) : null}
    </div>
  );
}
