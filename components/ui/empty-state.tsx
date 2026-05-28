import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// EmptyState — shared empty-state primitive for any list / table / grid
// surface that may have no rows yet. Different from
// `components/portal/ui/empty-state` (which has its own action prop shape
// used widely inside the portal): this version takes the explicit
// `primaryCta` / `secondaryCta` shape per the visual-polish spec and is
// the canonical entry point for new surfaces.
//
// Render:
//   ┌──────────────────────────────────────────────────┐
//   │                  ┌─────┐                          │
//   │                  │ icon│   (brand-tinted square)  │
//   │                  └─────┘                          │
//   │           Title sentence here.                    │
//   │   One-line explainer of what data lands here.     │
//   │      [ Primary CTA ]   [ Secondary CTA ]          │
//   └──────────────────────────────────────────────────┘
// ---------------------------------------------------------------------------

type Cta = { label: string; href: string };

export type EmptyStateProps = {
  title: string;
  body?: string;
  primaryCta?: Cta;
  secondaryCta?: Cta;
  /** Lucide icon — caller supplies stroke-width 1.5px per design system. */
  icon?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  body,
  primaryCta,
  secondaryCta,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border bg-card/40",
        "px-6 py-10 text-center flex flex-col items-center gap-2",
        className,
      )}
    >
      {icon ? (
        <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {body ? (
        <p className="max-w-md text-[12px] text-muted-foreground leading-relaxed">
          {body}
        </p>
      ) : null}
      {primaryCta || secondaryCta ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          {primaryCta ? (
            <Link
              href={primaryCta.href}
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary-dark transition-colors active:scale-[0.98]"
            >
              {primaryCta.label}
            </Link>
          ) : null}
          {secondaryCta ? (
            <Link
              href={secondaryCta.href}
              className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors active:scale-[0.98]"
            >
              {secondaryCta.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
