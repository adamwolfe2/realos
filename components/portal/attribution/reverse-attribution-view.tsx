"use client";

import * as React from "react";
import {
  ResolutionsTable,
  type ResolutionRow,
} from "@/components/portal/attribution/resolutions-table";

// ---------------------------------------------------------------------------
// ReverseAttributionView — the identified-visits list. The interactive
// node-graph flow ("Reverse attribution flow") was removed 2026-07-29
// (Adam: the flow visuals don't match the brand — lists over diagrams).
// The graph's click-to-filter went with it; the table stands on its own.
// ---------------------------------------------------------------------------

export function ReverseAttributionView({
  resolutions,
}: {
  resolutions: ResolutionRow[];
}) {
  return (
    <section className="ls-card p-4">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-foreground">
          Identified visits
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Who came, from where, and where they landed — resolved by the
          pixel.
        </p>
      </div>
      <ResolutionsTable rows={resolutions} filter={null} />
    </section>
  );
}
