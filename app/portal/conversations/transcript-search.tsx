"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

// ---------------------------------------------------------------------------
// TranscriptSearch
//
// Client-side controller for the conversations list filter state. All filter
// state lives in URL params so the operator can bookmark or share a filtered
// view (`?q=pricing&flag=needs_prompt_tuning&sort=longest`). The server
// component re-reads these params on every request.
//
// The search input debounces keystrokes (250 ms) before pushing a new URL so
// the list doesn't thrash while the operator types.
// ---------------------------------------------------------------------------

export type FilterChip = {
  key: string;
  label: string;
  count: number;
};

export type SortOption = {
  value: "newest" | "longest" | "most_flagged";
  label: string;
};

const SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest" },
  { value: "longest", label: "Longest" },
  { value: "most_flagged", label: "Most flagged" },
];

function TranscriptSearchInner({
  filters,
  initialQuery,
  initialFilter,
  initialSort,
}: {
  filters: FilterChip[];
  initialQuery: string;
  initialFilter: string;
  initialSort: SortOption["value"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = React.useState(initialQuery);
  const qRef = React.useRef(initialQuery);
  qRef.current = q;

  // Debounce the URL push to keep typing smooth. When q changes quickly we
  // only commit once the user pauses.
  React.useEffect(() => {
    if (q === initialQuery) return;
    const t = setTimeout(() => pushParams({ q }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function pushParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearQuery() {
    setQ("");
    pushParams({ q: null });
  }

  return (
    <div className="space-y-3">
      {/* Search + sort row */}
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--stone-gray)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search transcripts for any word or phrase..."
            className={cn(
              "w-full rounded-[6px] border border-[var(--border-cream)] bg-[var(--ivory)]",
              "pl-8 pr-8 py-2 text-sm text-[var(--near-black)] placeholder:text-[var(--stone-gray)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--focus-blue)]",
            )}
          />
          {q ? (
            <button
              type="button"
              onClick={clearQuery}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--stone-gray)] hover:text-[var(--near-black)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-widest text-[var(--stone-gray)]">
            Sort
          </label>
          <select
            value={initialSort}
            onChange={(e) => pushParams({ sort: e.target.value })}
            className={cn(
              "rounded-[6px] border border-[var(--border-cream)] bg-[var(--ivory)]",
              "px-2 py-1.5 text-xs text-[var(--near-black)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--focus-blue)]",
            )}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter chips */}
      <nav
        className="flex flex-wrap gap-1.5"
        aria-label="Filter conversations by flag"
      >
        {filters.map((f) => {
          const active = (initialFilter ?? "") === f.key;
          return (
            <button
              key={f.key || "all"}
              type="button"
              onClick={() => pushParams({ flag: f.key || null })}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1",
                "text-[11px] font-semibold whitespace-nowrap transition-colors",
                "ring-1 ring-inset",
                active
                  ? "bg-[var(--near-black)] text-[var(--ivory)] ring-[var(--near-black)]"
                  : "bg-[var(--ivory)] text-[var(--near-black)] ring-[var(--border-cream)] hover:bg-[var(--warm-sand)]",
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] rounded px-1 py-0.5",
                  "text-[10px] tabular-nums font-medium",
                  active
                    ? "bg-[var(--ivory)]/15 text-[var(--ivory)]"
                    : "bg-[var(--warm-sand)] text-[var(--olive-gray)]",
                )}
              >
                {f.count}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function TranscriptSearch(
  props: React.ComponentProps<typeof TranscriptSearchInner>,
) {
  return (
    <Suspense fallback={<div className="h-24 animate-pulse rounded-md bg-muted" />}>
      <TranscriptSearchInner {...props} />
    </Suspense>
  );
}
