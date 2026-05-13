import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// SectionLabel — the tiny tracked-out all-caps label that anchors a section
// (e.g. "JUMP IN", "INSIGHTS", "PORTFOLIO", "RECENT", "PROPERTY DATA"). One
// component, one type contract, used everywhere. Replaces the assortment of
// hand-rolled <div className="text-[10px] uppercase tracking-widest …">
// scattered across pages.
//
// Accepts an optional right-aligned slot for "View all" / count badges so the
// section header line stays one row.
// ---------------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
  /** Right-aligned slot — typically a link, count, or kebab menu. */
  trailing?: React.ReactNode;
  className?: string;
  as?: "h2" | "h3" | "div";
};

export function SectionLabel({
  children,
  trailing,
  className,
  as = "h2",
}: Props) {
  const Tag = as;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 mb-3",
        className,
      )}
    >
      <Tag className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {children}
      </Tag>
      {trailing ? (
        <div className="text-xs text-muted-foreground">{trailing}</div>
      ) : null}
    </div>
  );
}
