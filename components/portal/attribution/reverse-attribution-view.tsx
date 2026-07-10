"use client";

import * as React from "react";
import { X } from "lucide-react";
import {
  ReverseAttributionGraph,
  type RvNode,
  type RvLink,
  type GraphFilter,
} from "@/components/portal/attribution/reverse-attribution-graph";
import {
  ResolutionsTable,
  type ResolutionRow,
} from "@/components/portal/attribution/resolutions-table";

// ---------------------------------------------------------------------------
// ReverseAttributionView — client shell that links the interactive graph to
// the resolutions table. Clicking a source/landing node filters the table;
// a chip shows the active filter and clears it.
// ---------------------------------------------------------------------------

export function ReverseAttributionView({
  sources,
  landings,
  outcomes,
  links,
  resolutions,
}: {
  sources: RvNode[];
  landings: RvNode[];
  outcomes: RvNode[];
  links: RvLink[];
  resolutions: ResolutionRow[];
}) {
  const [filter, setFilter] = React.useState<GraphFilter>(null);

  return (
    <div className="space-y-3">
      <section className="ls-card p-4">
        <div className="mb-1">
          <h3 className="text-sm font-semibold text-foreground">
            Reverse attribution flow
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every visit traced back: the site they came from → the page they
            landed on → what happened. Blends GA4 + visitor pixel. Hover to trace
            a path; click a source or page to filter the table below.
          </p>
        </div>
        <ReverseAttributionGraph
          sources={sources}
          landings={landings}
          outcomes={outcomes}
          links={links}
          selected={filter}
          onSelect={setFilter}
        />
      </section>

      <section className="ls-card p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Identified visits
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Who came, from where, and where they landed — resolved by the
              pixel.
            </p>
          </div>
          {filter ? (
            <button
              type="button"
              onClick={() => setFilter(null)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
            >
              {filter.type === "source" ? "Source" : "Page"}: {filter.value}
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
        <ResolutionsTable rows={resolutions} filter={filter} />
      </section>
    </div>
  );
}
