"use client";

import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Live-updating per-source chip shown during an active scan. Idle state is
// blank; the scanner-panel unmounts this block once the scan is done.

export type SourceState = {
  status: "running" | "complete" | "failed";
  found?: number;
  newCount?: number;
  error?: string;
};

const SOURCE_LABELS: Record<string, string> = {
  google: "Google Reviews",
  tavily: "Reddit, Yelp, aggregators, forums",
};

export function SourceProgress({
  sources,
}: {
  sources: Record<string, SourceState>;
}) {
  const keys = ["google", "tavily"];
  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((k) => {
        const s = sources[k];
        if (!s) return null;
        const label = SOURCE_LABELS[k] ?? k;
        const Icon =
          s.status === "running"
            ? Loader2
            : s.status === "failed"
              ? XCircle
              : CheckCircle2;
        const tone =
          s.status === "failed"
            ? "border-destructive/40 bg-destructive/5 text-destructive"
            : s.status === "running"
              ? "border-border bg-muted/50 text-muted-foreground"
              : "border-primary/30 bg-primary/10 text-primary";
        return (
          <span
            key={k}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
              tone,
            )}
            title={s.error ?? undefined}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5",
                s.status === "running" && "animate-spin",
              )}
              aria-hidden="true"
            />
            <span>{label}</span>
            {s.status === "complete" && typeof s.found === "number" ? (
              <span className="text-[11px] font-semibold">
                {s.found}
                {typeof s.newCount === "number" && s.newCount > 0
                  ? ` (+${s.newCount})`
                  : ""}
              </span>
            ) : null}
            {s.status === "failed" ? (
              <span className="text-[11px] font-semibold">failed</span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
