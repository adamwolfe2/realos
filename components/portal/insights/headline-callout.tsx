import Link from "next/link";
import { ArrowRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HeadlineSignal } from "@/lib/signals/today";

// ----------------------------------------------------------------------------
// HeadlineCallout — the "Today's signal" hero card directly below the strip.
// Picks ONE narrative from the daily snapshot delta math and links to its
// canonical detail surface (reputation / chatbot / seo / leads).
// ----------------------------------------------------------------------------

export type HeadlineCalloutProps = {
  signal: HeadlineSignal | null;
};

export function HeadlineCallout({ signal }: HeadlineCalloutProps) {
  if (!signal) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="text-sm text-muted-foreground">
          No standout signal yet — your first daily scan will surface the
          movement that matters here.
        </div>
      </div>
    );
  }

  const Icon =
    signal.tone === "positive"
      ? TrendingUp
      : signal.tone === "negative"
        ? TrendingDown
        : Sparkles;

  const accent =
    signal.tone === "positive"
      ? "border-emerald-200 bg-emerald-50/40"
      : signal.tone === "negative"
        ? "border-rose-200 bg-rose-50/40"
        : "border-border bg-card";

  const iconColor =
    signal.tone === "positive"
      ? "text-emerald-600"
      : signal.tone === "negative"
        ? "text-rose-600"
        : "text-muted-foreground";

  const kindLabel = KIND_LABELS[signal.kind] ?? "Signal";

  return (
    <Link
      href={signal.href}
      className={cn(
        "group block rounded-xl border px-5 py-4 transition-all",
        accent,
        "hover:shadow-[0_2px_12px_rgba(15,23,42,0.06)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "h-9 w-9 shrink-0 rounded-lg bg-background border border-border flex items-center justify-center",
            iconColor,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Today&rsquo;s signal &middot; {kindLabel}
          </div>
          <div className="mt-1 text-base sm:text-lg font-medium text-foreground leading-snug">
            {signal.message}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

const KIND_LABELS: Record<HeadlineSignal["kind"], string> = {
  reputation: "Reputation",
  chatbot: "Chatbot",
  seo: "SEO",
  aeo: "AEO",
  leads: "Leads",
  traffic: "Traffic",
  overall: "Overview",
};
