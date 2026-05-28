"use client";

import Link from "next/link";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
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
  reddit: "Reddit",
  yelp: "Yelp",
};

// Norman bug #79 + bug #17: "Google Reviews failed" with no actionable
// next step. We classify the underlying error message into a small set
// of buckets and render a one-line hint inline beneath the failed chip,
// PLUS a follow-up CTA where one exists (e.g. "Edit property" deep link
// when the cause is a missing Place ID). This way the operator sees
// "Failed: no Google Place ID — Add Google Maps URL on the property's
// edit page" instead of an opaque red badge.
export type SourceDiagnosis = {
  message: string;
  cta?: { label: string; href: string };
};

function diagnoseGoogleError(
  error: string | undefined,
  propertyId?: string,
): SourceDiagnosis | null {
  if (!error) return null;
  const e = error.toLowerCase();
  // Place ID missing. Pre-launch we shipped a Places autocomplete on the
  // Property edit page (commit e5ca377) — point the operator at it so
  // they can resolve this themselves in <30s.
  if (
    e.includes("place id") ||
    e.includes("placeid") ||
    e.includes("no google place id")
  ) {
    return {
      message:
        "No Google Place ID on this property yet. Add the Google Maps URL on the property edit page — the autocomplete will resolve the Place ID for you.",
      cta: propertyId
        ? { label: "Edit property", href: `/portal/properties/${propertyId}/edit` }
        : undefined,
    };
  }
  if (
    e.includes("api_key") ||
    e.includes("api key") ||
    e.includes("not configured")
  ) {
    return {
      message:
        "Reputation scan unavailable — Google Places API key isn't configured on the server. Contact LeaseStack support.",
    };
  }
  if (e.includes("quota") || e.includes("rate") || e.includes("429")) {
    return {
      message:
        "Google Places API quota hit. Wait a few minutes and try the scan again.",
    };
  }
  if (
    e.includes("permission") ||
    e.includes("denied") ||
    e.includes("403") ||
    e.includes("forbidden")
  ) {
    return {
      message:
        "Google Places API key lacks Places (New) permission. Contact LeaseStack support.",
    };
  }
  if (
    e.includes("not_found") ||
    e.includes("404") ||
    e.includes("not found")
  ) {
    return {
      message:
        "Google couldn't find this property — the Place ID may have been deleted on Google's side. Re-pick the listing on the property edit page.",
      cta: propertyId
        ? { label: "Edit property", href: `/portal/properties/${propertyId}/edit` }
        : undefined,
    };
  }
  if (e.includes("timeout") || e.includes("aborterror")) {
    return {
      message:
        "Google Places API timed out. Try the scan again — this is usually transient.",
    };
  }
  if (e.includes("network") || e.includes("fetch failed")) {
    return {
      message:
        "Couldn't reach Google Places. Check your connection and retry.",
    };
  }
  // Fall through — surface the raw error so operators at least see WHAT
  // went wrong instead of a generic "failed" badge.
  const truncated = error.length > 200 ? `${error.slice(0, 197)}…` : error;
  return { message: `Google Reviews scan failed: ${truncated}` };
}

function diagnoseTavilyError(
  error: string | undefined,
): SourceDiagnosis | null {
  if (!error) return null;
  const e = error.toLowerCase();
  if (
    e.includes("api_key") ||
    e.includes("api key") ||
    e.includes("not configured")
  ) {
    return {
      message:
        "Reputation scan unavailable — Tavily API key isn't configured on the server. Contact LeaseStack support.",
    };
  }
  if (e.includes("quota") || e.includes("rate") || e.includes("429")) {
    return {
      message:
        "Tavily quota hit. Wait a few minutes and try the scan again.",
    };
  }
  const truncated = error.length > 200 ? `${error.slice(0, 197)}…` : error;
  return { message: `Web scan failed: ${truncated}` };
}

export function SourceProgress({
  sources,
  propertyId,
}: {
  sources: Record<string, SourceState>;
  /** When provided, diagnostics with a property-scoped CTA (e.g. "Edit
   *  property" for a missing Place ID) get a real deep link instead of
   *  generic copy. */
  propertyId?: string;
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
      {/* Inline diagnostic hint for failed sources. Bug #17: Norman saw
          "Google Reviews failed" with no actionable next step. Each known
          failure pattern now maps to a single-sentence hint + (when
          applicable) a deep link CTA so the operator knows what to do
          without a support ticket. */}
      {keys.map((k) => {
        const s = sources[k];
        if (!s || s.status !== "failed") return null;
        const diagnosis: SourceDiagnosis | null =
          k === "google"
            ? diagnoseGoogleError(s.error, propertyId)
            : k === "tavily"
              ? diagnoseTavilyError(s.error)
              : s.error
                ? { message: s.error }
                : null;
        if (!diagnosis) return null;
        return (
          <p
            key={`hint-${k}`}
            className="text-[11px] text-destructive/80 leading-snug"
          >
            <span className="font-semibold">{SOURCE_LABELS[k] ?? k}:</span>{" "}
            {diagnosis.message}
            {diagnosis.cta ? (
              <>
                {" "}
                <Link
                  href={diagnosis.cta.href}
                  className="inline-flex items-center gap-0.5 font-semibold text-destructive underline-offset-2 hover:underline"
                >
                  {diagnosis.cta.label}
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </>
            ) : null}
          </p>
        );
      })}
    </div>
  );
}
