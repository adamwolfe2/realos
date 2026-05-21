"use client";

import { ChevronDown } from "lucide-react";
import {
  TOP_CATEGORY_ORDER,
  type BucketCounts,
  type TopCategory,
} from "@/lib/seo/categorize-recommendation";

// ---------------------------------------------------------------------------
// OpportunitiesSidebar — categories tree on the left of the Opportunities
// feed. Pure presentation; selection state is owned by the parent client
// component. "All" sits at the top showing the unfiltered count; each top
// category is a collapsible header (open by default) with indented
// sub-buckets underneath.
//
// Empty sub-buckets are hidden — a bucket with zero recs is noise. Empty
// top categories still render so the operator sees the full taxonomy and
// understands what's possible.
// ---------------------------------------------------------------------------

export type SelectedBucket =
  | { kind: "all" }
  | { kind: "top"; topCategory: TopCategory }
  | { kind: "sub"; topCategory: TopCategory; subBucket: string };

function isSameSelection(a: SelectedBucket, b: SelectedBucket): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "all" || b.kind === "all") return a.kind === b.kind;
  if (a.kind === "top" && b.kind === "top") {
    return a.topCategory === b.topCategory;
  }
  if (a.kind === "sub" && b.kind === "sub") {
    return (
      a.topCategory === b.topCategory && a.subBucket === b.subBucket
    );
  }
  return false;
}

type Props = {
  counts: BucketCounts;
  total: number;
  selected: SelectedBucket;
  onSelect: (next: SelectedBucket) => void;
};

export function OpportunitiesSidebar({
  counts,
  total,
  selected,
  onSelect,
}: Props) {
  return (
    <nav
      aria-label="Opportunity categories"
      className="w-full md:w-56 md:sticky md:top-6 md:self-start shrink-0"
    >
      <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2 px-2">
        Categories
      </p>

      <ul className="space-y-0.5">
        <li>
          <SidebarRow
            label="All"
            count={total}
            active={selected.kind === "all"}
            onClick={() => onSelect({ kind: "all" })}
          />
        </li>

        {TOP_CATEGORY_ORDER.map((top) => {
          const slot = counts[top];
          const subEntries = Object.entries(slot.subBuckets)
            .filter(([, n]) => n > 0)
            .sort(([a], [b]) => a.localeCompare(b));
          const topActive = isSameSelection(selected, {
            kind: "top",
            topCategory: top,
          });

          return (
            <li key={top} className="pt-2 first:pt-0">
              <SidebarRow
                label={top}
                count={slot.total}
                active={topActive}
                isGroup
                onClick={() =>
                  onSelect({ kind: "top", topCategory: top })
                }
              />
              {subEntries.length > 0 ? (
                <ul className="mt-0.5 space-y-0.5">
                  {subEntries.map(([sub, n]) => {
                    const active = isSameSelection(selected, {
                      kind: "sub",
                      topCategory: top,
                      subBucket: sub,
                    });
                    return (
                      <li key={sub}>
                        <SidebarRow
                          label={sub}
                          count={n}
                          active={active}
                          indent
                          onClick={() =>
                            onSelect({
                              kind: "sub",
                              topCategory: top,
                              subBucket: sub,
                            })
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SidebarRow({
  label,
  count,
  active,
  indent = false,
  isGroup = false,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  indent?: boolean;
  isGroup?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        indent ? "pl-6" : "",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      ].join(" ")}
      aria-pressed={active}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        {isGroup ? (
          <ChevronDown
            size={12}
            className="shrink-0 opacity-60"
            aria-hidden
          />
        ) : null}
        <span
          className={[
            "truncate",
            isGroup
              ? "text-[12px] font-semibold"
              : "text-[12px] font-medium",
          ].join(" ")}
        >
          {label}
        </span>
      </span>
      <span
        className={[
          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-mono tabular-nums",
          active
            ? "bg-background text-foreground"
            : "bg-muted/70 text-muted-foreground",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}
