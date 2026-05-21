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

// Norman bug #79: "Google Reviews failed" with no actionable next step.
// We classify the underlying error message into a small set of buckets
// and render a one-line hint inline beneath the failed chip. This way
// the operator sees "Failed: no Google Place ID — add the property's
// Google Maps URL on the Property settings page" instead of an opaque
// red badge they have to hover over.
function diagnoseGoogleError(error: string | undefined): string | null {
  if (!error) return null;
  const e = error.toLowerCase();
  if (e.includes("place id") || e.includes("placeid")) {
    return "Add the property's Google Maps URL on the Property settings page so we can resolve its Place ID.";
  }
  if (e.includes("api_key") || e.includes("api key") || e.includes("not configured")) {
    return "GOOGLE_PLACES_API_KEY isn't configured on the server. Contact the LeaseStack team.";
  }
  if (e.includes("quota") || e.includes("rate") || e.includes("429")) {
    return "Google Places API quota hit. Try again in a few minutes.";
  }
  if (e.includes("permission") || e.includes("denied") || e.includes("403")) {
    return "Google Places API key lacks Places (New) permission. Contact the LeaseStack team.";
  }
  return error.length > 140 ? `${error.slice(0, 137)}…` : error;
}

export function SourceProgress({
  sources,
}: {
  sources: Record<string, SourceState>;
}) {
  const keys = ["google", "tavily"];
  return (
    <div className="space-y-2">
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
      {/* Inline diagnostic hint for the most actionable case (Google
          scan failure). Only renders when a known error pattern matches
          OR we have an error string at all — silent for ok runs. */}
      {keys.map((k) => {
        const s = sources[k];
        if (!s || s.status !== "failed") return null;
        const hint =
          k === "google" ? diagnoseGoogleError(s.error) : s.error ?? null;
        if (!hint) return null;
        return (
          <p
            key={`hint-${k}`}
            className="text-[11px] text-destructive/80 leading-snug"
          >
            <span className="font-semibold">{SOURCE_LABELS[k] ?? k}:</span>{" "}
            {hint}
          </p>
        );
      })}
    </div>
  );
}
