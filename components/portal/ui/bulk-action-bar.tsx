"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// BulkActionBar — the canonical "N selected" toolbar that floats above a
// table when one or more rows are checked. Replaces the inconsistent
// per-page implementations across Leads, Visitors, etc.
//
// Layout: [count] selected   [actions ...]   [×]
//
// Renders nothing when count === 0 so callers can mount it unconditionally.
// Actions are passed as children — the bar provides the chrome (count
// pill, dismiss button, sticky shell). Caller controls the actual buttons.
//
// Usage:
//   <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
//     <button className="btn-ghost-sm" onClick={onTag}>Tag</button>
//     <button className="btn-ghost-sm" onClick={onAssign}>Assign</button>
//     <button className="btn-ghost-sm" onClick={onExport}>Export</button>
//   </BulkActionBar>
// ---------------------------------------------------------------------------

type Props = {
  count: number;
  onClear: () => void;
  /** Action buttons. Caller owns the visual treatment. */
  children: React.ReactNode;
  /** Singular noun ("lead", "visitor"). Used in the "N selected" label. */
  noun?: string;
  className?: string;
  /** When true, the bar floats at the bottom of the viewport instead of
   *  sitting inline. Useful on long tables where the user has scrolled. */
  floating?: boolean;
};

export function BulkActionBar({
  count,
  onClear,
  children,
  noun = "row",
  className,
  floating,
}: Props) {
  if (count === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={`${count} ${noun}${count === 1 ? "" : "s"} selected — bulk actions`}
      className={cn(
        "z-30 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-md",
        floating
          ? "fixed left-1/2 -translate-x-1/2 bottom-6 max-w-[min(92vw,720px)]"
          : "sticky top-2",
        className,
      )}
    >
      <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1">
        <span className="text-xs font-semibold tabular-nums text-primary">
          {count}
        </span>
        <span className="text-[11px] font-medium text-primary/80">
          {noun}
          {count === 1 ? "" : "s"} selected
        </span>
      </div>

      <div className="h-5 w-px bg-border" aria-hidden="true" />

      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>

      <div className="ml-auto flex items-center pl-2">
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
