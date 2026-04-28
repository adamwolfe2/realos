"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import { SegmentTable, type SegmentRow } from "./segment-table";
import type { InlinePushDestination } from "./inline-push";

type ReachBand = "all" | "huge" | "mid" | "small";

const REACH_BANDS: Array<{ id: ReachBand; label: string }> = [
  { id: "all", label: "All" },
  { id: "huge", label: "1M+" },
  { id: "mid", label: "100K — 1M" },
  { id: "small", label: "Under 100K" },
];

function withinBand(memberCount: number, band: ReachBand): boolean {
  switch (band) {
    case "all":
      return true;
    case "huge":
      return memberCount >= 1_000_000;
    case "mid":
      return memberCount >= 100_000 && memberCount < 1_000_000;
    case "small":
      return memberCount < 100_000;
  }
}

function withinState(row: SegmentRow, stateFilter: string): boolean {
  if (!stateFilter) return true;
  const target = stateFilter.toUpperCase();
  // The raw payload's top_states is denormalized into a column; we re-derive
  // it on the parent. As a fallback, if no states data made it through,
  // fall back to a name match so the filter still feels responsive.
  if (row.topStates?.some((s) => s.toUpperCase() === target)) return true;
  return row.name.toUpperCase().includes(target);
}

export function SegmentListView({
  rows,
  destinations,
  availableStates,
}: {
  rows: SegmentRow[];
  destinations: InlinePushDestination[];
  availableStates: string[];
}) {
  const [query, setQuery] = useState("");
  const [reachBand, setReachBand] = useState<ReachBand>("all");
  const [stateFilter, setStateFilter] = useState<string>("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!withinBand(row.memberCount, reachBand)) return false;
      if (!withinState(row, stateFilter)) return false;
      if (!q) return true;
      const hay = `${row.name} ${row.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, reachBand, stateFilter]);

  const hasFilter = query !== "" || reachBand !== "all" || stateFilter !== "";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search segments…"
            className={cn(
              "w-full h-8 rounded-md border border-input bg-background pl-8 pr-8 text-sm shadow-xs",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            aria-label="Search segments"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-1 rounded-md border border-input p-0.5 bg-background">
          {REACH_BANDS.map((band) => (
            <button
              key={band.id}
              type="button"
              onClick={() => setReachBand(band.id)}
              className={cn(
                "px-2 h-7 rounded text-xs font-medium transition-colors tabular-nums",
                reachBand === band.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {band.label}
            </button>
          ))}
        </div>

        {availableStates.length > 0 ? (
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs"
            aria-label="Filter by state"
          >
            <option value="">All states</option>
            {availableStates.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : null}

        {hasFilter ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setReachBand("all");
              setStateFilter("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        ) : null}

        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered.length} of {rows.length}
        </div>
      </div>

      <SegmentTable rows={filtered} destinations={destinations} />
    </div>
  );
}
