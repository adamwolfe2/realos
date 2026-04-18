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
  const toneClass =
    tone === "warn"
      ? "border-primary/30 bg-primary/5"
      : tone === "danger"
        ? "border-destructive/30 bg-destructive/5"
        : tone === "success"
          ? "border-emerald-200 bg-emerald-50"
          : "border-border bg-card";
  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-shadow duration-150 hover:shadow-sm",
        toneClass,
        className,
      )}
    >
      <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="font-serif text-3xl font-bold mt-2 tabular-nums text-foreground">
        {value}
      </div>
      {hint ? (
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      ) : null}
    </div>
  );
}
