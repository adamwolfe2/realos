"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// SegmentedControl — the canonical filter/tab toggle. Replaces the assortment
// of "filled blue pill against unfilled neighbors" button groups across
// Insights, Conversations, Renewals, Reports, etc. Same component, two
// rendering modes:
//
//   1. options + value + onChange → controlled stateful client toggle
//   2. options with `href` → server-rendered links (preserves SSR)
//
// One option must be marked `active` when using the href variant.
// ---------------------------------------------------------------------------

export type SegmentedOption = {
  value: string;
  label: React.ReactNode;
  count?: number;
  href?: string;
  active?: boolean;
};

type Props = {
  options: SegmentedOption[];
  value?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
};

export function SegmentedControl({
  options,
  value,
  onChange,
  size = "md",
  className,
  ariaLabel,
}: Props) {
  const isLink = options.some((opt) => opt.href);

  const segmentBase = cn(
    "inline-flex items-center gap-1.5 font-medium transition-colors whitespace-nowrap",
    size === "sm" ? "px-2.5 h-7 text-xs" : "px-3 h-8 text-[13px]",
    "rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60",
  );

  const activeClass =
    "bg-card text-foreground shadow-[0_0_0_1px_var(--color-border)]";

  return (
    <div
      role={isLink ? undefined : "tablist"}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = opt.href ? !!opt.active : opt.value === value;
        const content = (
          <>
            <span>{opt.label}</span>
            {typeof opt.count === "number" ? (
              <span
                className={cn(
                  "tabular-nums text-[11px]",
                  isActive ? "text-muted-foreground" : "text-muted-foreground/70",
                )}
              >
                {opt.count}
              </span>
            ) : null}
          </>
        );

        if (opt.href) {
          return (
            <Link
              key={opt.value}
              href={opt.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(segmentBase, isActive && activeClass)}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(opt.value)}
            className={cn(segmentBase, isActive && activeClass)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
