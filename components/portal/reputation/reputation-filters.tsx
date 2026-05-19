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

  return (
    <div className="flex flex-col gap-2">
      <FilterRow
        label="Source"
        options={SOURCE_OPTIONS.map((o) => ({
          ...o,
          count: o.value === "all" ? undefined : sourceCounts?.[o.value],
        }))}
        active={activeSource}
        onChange={(v) => setParam("source", v)}
      />
      <FilterRow
        label="Sentiment"
        options={SENTIMENT_OPTIONS.map((o) => ({
          ...o,
          count: o.value === "all" ? undefined : sentimentCounts?.[o.value],
        }))}
        active={activeSentiment}
        onChange={(v) => setParam("sentiment", v)}
      />
    </div>
  );
}

function FilterRow<T extends string>({
  label,
  options,
  active,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string; count?: number }>;
  active: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground w-16 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {options.map((opt) => {
          const isActive = opt.value === active;
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors " +
                (isActive
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-foreground border-border hover:bg-muted")
              }
              aria-pressed={isActive}
            >
              <span>{opt.label}</span>
              {typeof opt.count === "number" && opt.count > 0 ? (
                <span
                  className={
                    "tabular-nums " +
                    (isActive ? "text-background/80" : "text-muted-foreground")
                  }
                >
                  {opt.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
