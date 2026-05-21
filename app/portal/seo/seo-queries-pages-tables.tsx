"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// SeoQueriesPagesTables — the dense, side-by-side "Queries" + "Pages" tables
// pinned to the bottom of the overview screen. Compact: 8 rows max, value
// label on the left, click count right-aligned. Matches the Searchable
// reference layout.
//
// "View All" is a soft link to the agent view where the full tables live.
// If routes change in the future the anchor still won't error — it just
// lands on the agent index.
// ---------------------------------------------------------------------------

export type RankedRow = {
  label: string;
  clicks: number;
  impressions?: number;
};

export function SeoQueriesPagesTables({
  queries,
  pages,
}: {
  queries: RankedRow[];
  pages: RankedRow[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <RankedTable
        title="Queries"
        rows={queries}
        emptyHint="No query data yet. Run a Search Console sync to populate."
        viewAllHref="/portal/seo/agent?tab=queries"
        labelHeading="Query"
      />
      <RankedTable
        title="Pages"
        rows={pages}
        emptyHint="No page data yet. Connect Analytics 4 to populate."
        viewAllHref="/portal/seo/agent?tab=pages"
        labelHeading="Page"
        mono
      />
    </div>
  );
}

function RankedTable({
  title,
  rows,
  emptyHint,
  viewAllHref,
  labelHeading,
  mono = false,
}: {
  title: string;
  rows: RankedRow[];
  emptyHint: string;
  viewAllHref: string;
  labelHeading: string;
  mono?: boolean;
}) {
  const visible = rows.slice(0, 8);
  return (
    <div className="ls-card p-4 flex flex-col">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3
          className="text-[13px] font-semibold tracking-tight text-foreground leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          Top {visible.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-6 leading-relaxed">
          {emptyHint}
        </p>
      ) : (
        <ul className="divide-y divide-border flex-1">
          {visible.map((row, idx) => (
            <li
              key={`${row.label}-${idx}`}
              className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
            >
              <span
                className={`min-w-0 flex-1 truncate text-[12px] text-foreground ${
                  mono ? "font-mono text-[11px]" : ""
                }`}
                title={row.label}
              >
                {row.label}
              </span>
              <span className="shrink-0 text-[12px] tabular-nums font-mono text-muted-foreground">
                {row.clicks.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 pt-3 border-t border-border">
        <a
          href={viewAllHref}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
