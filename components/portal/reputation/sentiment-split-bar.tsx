import Link from "next/link";
import { Sentiment } from "@prisma/client";

// Sentiment split bar segment order + coloring. Negative uses the
// destructive/error token (not the muted-black treatment used elsewhere on
// this page) so a bad stretch actually reads as a warning at a glance.
const SENTIMENT_BAR_SEGMENTS: Array<{
  key: Sentiment;
  label: string;
  swatchClass: string;
}> = [
  { key: "POSITIVE", label: "Positive", swatchClass: "bg-success" },
  { key: "NEUTRAL", label: "Neutral", swatchClass: "bg-muted-foreground/30" },
  { key: "MIXED", label: "Mixed", swatchClass: "bg-muted-foreground/50" },
  { key: "NEGATIVE", label: "Negative", swatchClass: "bg-destructive" },
];

// One full-width flat segmented bar (deliberately square, not the rounded
// pill bars used in the analytics drawer below) + a legend that reuses the
// page's existing ?sentiment= filter mechanism — clicking a legend item
// navigates straight into that sentiment's filtered feed, same as the
// chips in <ReputationFilters />.
export function SentimentSplitBar({
  positive,
  neutral,
  mixed,
  negative,
  total,
  activeSentiment,
  currentParams,
}: {
  positive: number;
  neutral: number;
  mixed: number;
  negative: number;
  total: number;
  activeSentiment: Sentiment | null;
  currentParams: {
    property?: string;
    properties?: string;
    source?: string;
    showOlder?: string;
  };
}) {
  const counts: Record<Sentiment, number> = {
    POSITIVE: positive,
    NEUTRAL: neutral,
    MIXED: mixed,
    NEGATIVE: negative,
  };

  return (
    <section aria-label="Sentiment split" className="space-y-2">
      <div className="flex h-3.5 w-full gap-px overflow-hidden border border-border bg-muted">
        {SENTIMENT_BAR_SEGMENTS.map((seg) => {
          const count = counts[seg.key];
          if (count <= 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={seg.key}
              className={seg.swatchClass}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${count.toLocaleString()} (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {SENTIMENT_BAR_SEGMENTS.map((seg) => {
          const count = counts[seg.key];
          const isActive = activeSentiment === seg.key;
          return (
            <Link
              key={seg.key}
              href={sentimentFilterHref(seg.key, activeSentiment, currentParams)}
              className={`flex items-center gap-1.5 text-xs transition-colors hover:text-foreground ${
                isActive ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 ${seg.swatchClass}`}
                aria-hidden="true"
              />
              {seg.label}
              <span className="font-mono tabular-nums">
                {count.toLocaleString()}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// Builds the sentiment-filter href for a legend item, preserving the
// property/properties/source params already on the URL — same toggle
// semantics as <RecentToggleLink />: clicking the already-active sentiment
// clears the filter back to "all".
function sentimentFilterHref(
  sentiment: Sentiment,
  activeSentiment: Sentiment | null,
  currentParams: {
    property?: string;
    properties?: string;
    source?: string;
    showOlder?: string;
  },
): string {
  const next = new URLSearchParams();
  if (currentParams.property) next.set("property", currentParams.property);
  if (currentParams.properties)
    next.set("properties", currentParams.properties);
  if (currentParams.source) next.set("source", currentParams.source);
  // Preserve the "Show older" window like ReputationFilters does — dropping
  // it would snap the feed back to 90 days on a legend click.
  if (currentParams.showOlder) next.set("showOlder", currentParams.showOlder);
  if (activeSentiment !== sentiment) next.set("sentiment", sentiment);
  const qs = next.toString();
  return `/portal/reputation${qs ? `?${qs}` : ""}`;
}
