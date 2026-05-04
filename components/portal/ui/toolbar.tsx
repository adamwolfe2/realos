"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Toolbar + FilterPill — Twenty-style filter chip toolbar used above
// dense data lists (Leads, Visitors, Properties, Conversations). Replaces
// the per-page form-based filter bars with a unified inline experience:
//
//   <Toolbar>
//     <FilterGroup legend="Status">
//       <FilterPill href="?status=ACTIVE" active={status === 'ACTIVE'}>Active</FilterPill>
//       ...
//     </FilterGroup>
//   </Toolbar>
//
// Pure CSS, no client state — selection lives in the URL so each pill is
// just a Next.js <Link>. That keeps everything bookmarkable + SSR-friendly.
// ---------------------------------------------------------------------------

export function Toolbar({
  children,
  className,
  trailing,
}: {
  children: React.ReactNode;
  className?: string;
  /** Right-aligned slot — used for sort dropdowns, density toggles, exports. */
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-3 py-2",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1 min-w-0">
        {children}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function FilterGroup({
  legend,
  children,
}: {
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground shrink-0">
        {legend}
      </span>
      <div className="inline-flex items-center rounded-md border border-border bg-secondary p-0.5">
        {children}
      </div>
    </div>
  );
}

export function FilterPill({
  href,
  active,
  children,
  count,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
      {count != null && count > 0 ? (
        <span
          className={cn(
            "tabular-nums text-[10px] rounded px-1",
            active
              ? "bg-background/20 text-background"
              : "bg-muted-foreground/15 text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
