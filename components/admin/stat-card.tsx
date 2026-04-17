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
      ? "border-amber-300 bg-amber-50"
      : tone === "danger"
      ? "border-red-300 bg-red-50"
      : tone === "success"
      ? "border-emerald-300 bg-emerald-50"
      : "";
  return (
    <div className={cn("border rounded-md p-4", toneClass, className)}>
      <div className="text-[10px] tracking-widest uppercase opacity-60">
        {label}
      </div>
      <div className="font-serif text-3xl font-bold mt-2 tabular-nums">
        {value}
      </div>
      {hint ? <div className="text-xs opacity-60 mt-1">{hint}</div> : null}
    </div>
  );
}
