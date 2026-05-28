"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { MentionSource, Sentiment } from "@prisma/client";

// ---------------------------------------------------------------------------
// Filter chips for /portal/reputation.
//
// Two filter axes, both surfaced as URL search params so views are
// bookmarkable + deep-linkable (e.g. shareable "all negative Reddit" URL):
//   * source: "all" | "GOOGLE_REVIEW" | "REDDIT" | "YELP" | "TAVILY_WEB"
//   * sentiment: "all" | "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED"
//
// Behavior:
//   * Click toggles between specific value and "all" — no separate "clear"
//     button is needed.
//   * Updates the URL in place via router.replace so the back button isn't
//     polluted by filter twiddles.
//   * Preserves any other params (?property=, ?properties=).
//
// Design (per the portal's premium-pass language):
//   * Subdued pill rail, no shadows.
//   * Active chip = solid foreground bg, inactive = bordered ghost.
//   * Per-source chips show the brand color when active.
// ---------------------------------------------------------------------------

export type SourceFilter = "all" | MentionSource;
export type SentimentFilter = "all" | Sentiment;

type SourceChip = { value: SourceFilter; label: string; count?: number };
type SentimentChip = { value: SentimentFilter; label: string; count?: number };

const SOURCE_OPTIONS: Array<SourceChip> = [
  { value: "all", label: "All" },
  { value: "GOOGLE_REVIEW", label: "Google" },
  { value: "REDDIT", label: "Reddit" },
  { value: "YELP", label: "Yelp" },
  { value: "TAVILY_WEB", label: "Web" },
];

const SENTIMENT_OPTIONS: Array<SentimentChip> = [
  { value: "all", label: "All" },
  { value: "POSITIVE", label: "Positive" },
  { value: "NEUTRAL", label: "Neutral" },
  { value: "NEGATIVE", label: "Negative" },
  { value: "MIXED", label: "Mixed" },
];

export function ReputationFilters({
  sourceCounts,
  sentimentCounts,
}: {
  sourceCounts?: Partial<Record<MentionSource, number>>;
  sentimentCounts?: Partial<Record<Sentiment, number>>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const activeSource = (params.get("source") ?? "all") as SourceFilter;
  const activeSentiment = (params.get("sentiment") ?? "all") as SentimentFilter;

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const hasActiveFilter = activeSource !== "all" || activeSentiment !== "all";

  function clearAll() {
    const next = new URLSearchParams(params.toString());
    next.delete("source");
    next.delete("sentiment");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <FilterRow
        label="Source"
        options={SOURCE_OPTIONS}
        active={activeSource}
        onChange={(v) => setParam("source", v)}
      />
      <FilterRow
        label="Sentiment"
        options={SENTIMENT_OPTIONS}
        active={activeSentiment}
        onChange={(v) => setParam("sentiment", v)}
        trailing={
          hasActiveFilter ? (
            <button
              type="button"
              onClick={clearAll}
              className="ml-1 text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
            >
              Clear
            </button>
          ) : null
        }
      />
    </div>
  );
}

function FilterRow<T extends string>({
  label,
  options,
  active,
  onChange,
  trailing,
}: {
  label: string;
  options: Array<{ value: T; label: string; count?: number }>;
  active: T;
  onChange: (next: T) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">
        {label}:
      </span>
      {options.map((opt) => {
        const isActive = opt.value === active;
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={
              isActive
                ? "px-2.5 py-1 text-xs rounded-md border border-foreground/20 bg-muted/60 text-foreground font-medium transition-colors"
                : "px-2.5 py-1 text-xs rounded-md border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            }
            aria-pressed={isActive}
          >
            {opt.label}
          </button>
        );
      })}
      {trailing}
    </div>
  );
}
