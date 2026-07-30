"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import {
  bucketCountsForRecommendations,
  categorizeRecommendation,
  TOP_CATEGORY_ORDER,
  type BucketCounts,
  type TopCategory,
} from "@/lib/seo/categorize-recommendation";
import { OpportunitiesCategoryChips } from "./opportunities-sidebar";
import {
  SeverityChip,
  OpportunityRowActions,
  type Severity,
} from "./opportunity-card";
import { DataTable, type DataTableColumn } from "@/components/portal/ui/data-table";

// ---------------------------------------------------------------------------
// OpportunitiesClient — owns the entire interactivity surface of the
// /portal/seo/recommendations page.
//
// Inputs: pre-computed list of open recs from the server component, plus
// the initial bucket counts (cheaper to compute server-side than ship a
// raw list of all open recs without context). We still recompute counts on
// the client whenever the resolved-set changes, so optimistic resolves
// also decrement the category chips.
//
// State:
//   - category/sub  : URL-driven (?category=&sub=) via the shared
//                      StatusChipStrip — was local useState, converted so
//                      the chip strip's Link-based API works.
//   - search        : free-text filter against title + detail (unchanged,
//                      stays client-local — not part of the chip pattern).
//   - resolvedIds   : ids removed via Done / Decline; never come back this
//                      render. Server refresh re-fetches.
//
// Filtering is a single pass: O(n) per render where n = open recs for the
// org. Memoised so typing in the search box stays smooth at hundreds of
// recs.
// ---------------------------------------------------------------------------

type ServerRec = {
  id: string;
  category: string;
  severity: Severity;
  title: string;
  detail: string;
  score: number;
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
  const searchParams = useSearchParams();
  const category = (TOP_CATEGORY_ORDER as readonly string[]).includes(
    searchParams.get("category") ?? "",
  )
    ? (searchParams.get("category") as TopCategory)
    : undefined;
  const sub = category ? searchParams.get("sub") ?? undefined : undefined;

  const [search, setSearch] = useState("");
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  // Annotate each rec with its bucket once — used by both the chip recount
  // and the filter step.
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
      if (category && r.topCategory !== category) return false;
      if (sub && r.subBucket !== sub) return false;
      if (needle.length > 0) {
        const hay = `${r.title} ${r.detail}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [liveRecs, category, sub, search]);

  function handleResolved(id: string) {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  type Row = (typeof filtered)[number];

  const columns: DataTableColumn<Row>[] = [
    {
      key: "title",
      header: "Opportunity",
      accessor: (r) => (
        <div className="min-w-0 max-w-[440px]">
          <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-1">
            {r.title}
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground leading-snug line-clamp-2">
            {r.detail}
          </p>
          {r.propertyName ? (
            <p className="mt-1 text-[10.5px] text-muted-foreground truncate">
              {r.propertyName}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      width: "170px",
      accessor: (r) => (
        <span className="inline-flex items-center rounded-[2px] border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground whitespace-nowrap">
          {r.subBucket}
        </span>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      width: "110px",
      accessor: (r) => <SeverityChip severity={r.severity} />,
    },
    {
      key: "score",
      header: "Score",
      width: "64px",
      align: "right",
      accessor: (r) => (
        <span className="tabular-nums text-foreground">
          {Math.round(r.score)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "190px",
      accessor: (r) => (
        <OpportunityRowActions id={r.id} onResolved={handleResolved} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <OpportunitiesCategoryChips
        counts={counts}
        total={total}
        category={category}
        sub={sub}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-[13px] text-foreground">
          <span className="font-semibold tabular-nums">{filtered.length}</span>{" "}
          <span className="text-muted-foreground">
            {filtered.length === 1 ? "opportunity" : "opportunities"}
            {category ? (
              <>
                {" "}
                in{" "}
                <span className="text-foreground font-medium">
                  {sub ? `${category} · ${sub}` : category}
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

      <DataTable
        columns={columns}
        rows={filtered}
        emptyState={
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
        }
      />
    </div>
  );
}

// Re-export for the server file so it can pass through the right type without
// pulling in TopCategory directly.
export type { TopCategory };
