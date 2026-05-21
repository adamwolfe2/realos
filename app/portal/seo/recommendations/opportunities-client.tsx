"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import {
  bucketCountsForRecommendations,
  categorizeRecommendation,
  type BucketCounts,
  type TopCategory,
} from "@/lib/seo/categorize-recommendation";
import {
  OpportunitiesSidebar,
  type SelectedBucket,
} from "./opportunities-sidebar";
import {
  OpportunityCard,
  type OpportunityCardData,
} from "./opportunity-card";

// ---------------------------------------------------------------------------
// OpportunitiesClient — owns the entire interactivity surface of the
// /portal/seo/recommendations page.
//
// Inputs: pre-computed list of open recs from the server component, plus
// the initial bucket counts (cheaper to compute server-side than ship a
// raw list of all open recs without context). We still recompute counts on
// the client whenever the resolved-set changes, so optimistic resolves
// also decrement the sidebar.
//
// State:
//   - selected     : which bucket is active (All / Top / Sub)
//   - search       : free-text filter against title + detail
//   - resolvedIds  : ids removed via Done / Decline; never come back this
//                    render. Server refresh re-fetches.
//
// Filtering is a single pass: O(n) per render where n = open recs for the
// org. Memoised so typing in the search box stays smooth at hundreds of
// recs.
// ---------------------------------------------------------------------------

type ServerRec = {
  id: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
  propertyName: string | null;
};

type Props = {
  recommendations: ServerRec[];
  initialCounts: BucketCounts;
  initialTotal: number;
};

export function OpportunitiesClient({
  recommendations,
  initialCounts,
  initialTotal,
}: Props) {
  const [selected, setSelected] = useState<SelectedBucket>({ kind: "all" });
  const [search, setSearch] = useState("");
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  // Annotate each rec with its bucket once — used by both the sidebar
  // recount and the filter step.
  const annotated = useMemo(
    () =>
      recommendations.map((r) => {
        const bucket = categorizeRecommendation(r.category);
        return {
          ...r,
          topCategory: bucket.topCategory,
          subBucket: bucket.subBucket,
        };
      }),
    [recommendations],
  );

  const liveRecs = useMemo(
    () => annotated.filter((r) => !resolvedIds.has(r.id)),
    [annotated, resolvedIds],
  );

  // Recompute counts as recs get resolved. Server values are used until the
  // first optimistic resolve, then we take over. Cheap — same O(n) the
  // server does.
  const counts: BucketCounts =
    resolvedIds.size === 0
      ? initialCounts
      : bucketCountsForRecommendations(liveRecs);
  const total = resolvedIds.size === 0 ? initialTotal : liveRecs.length;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return liveRecs.filter((r) => {
      if (selected.kind === "top" && r.topCategory !== selected.topCategory) {
        return false;
      }
      if (selected.kind === "sub") {
        if (r.topCategory !== selected.topCategory) return false;
        if (r.subBucket !== selected.subBucket) return false;
      }
      if (needle.length > 0) {
        const hay = `${r.title} ${r.detail}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [liveRecs, selected, search]);

  function handleResolved(id: string) {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <OpportunitiesSidebar
        counts={counts}
        total={total}
        selected={selected}
        onSelect={setSelected}
      />

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[13px] text-foreground">
            <span className="font-semibold tabular-nums">
              {filtered.length}
            </span>{" "}
            <span className="text-muted-foreground">
              {filtered.length === 1 ? "opportunity" : "opportunities"}
              {selected.kind !== "all" ? (
                <>
                  {" "}
                  in{" "}
                  <span className="text-foreground font-medium">
                    {labelForSelection(selected)}
                  </span>
                </>
              ) : null}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              title="Coming soon"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <SlidersHorizontal size={12} />
              Filter
            </button>
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search opportunities"
                className="w-full sm:w-64 rounded-md border border-border bg-background pl-7 pr-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-[13px] font-medium text-foreground">
              {liveRecs.length === 0
                ? "Nothing open — you're caught up."
                : "No opportunities match this view."}
            </p>
            <p className="text-[12px] text-muted-foreground mt-1">
              {liveRecs.length === 0
                ? "New recommendations appear here as the SEO Agent finishes its next scan."
                : "Try a different category or clear your search."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((r) => {
              const card: OpportunityCardData = {
                id: r.id,
                title: r.title,
                detail: r.detail,
                severity: r.severity,
                category: r.category,
                topCategory: r.topCategory,
                subBucket: r.subBucket,
                propertyName: r.propertyName,
              };
              return (
                <li key={r.id}>
                  <OpportunityCard rec={card} onResolved={handleResolved} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function labelForSelection(sel: SelectedBucket): string {
  if (sel.kind === "all") return "All";
  if (sel.kind === "top") return sel.topCategory;
  return `${sel.topCategory} · ${sel.subBucket}`;
}

// Re-export for the server file so it can pass through the right type without
// pulling in TopCategory directly.
export type { TopCategory };
