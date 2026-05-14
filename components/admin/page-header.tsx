import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PageHeader — the canonical "page chrome" used at the top of every admin /
// portal page. Replaces the assortment of hand-rolled headers (text-xl /
// text-2xl / text-[28px] / serif "Welcome, …" marketing voice) so every
// page reads as the same product.
//
// Anatomy:
//   [optional breadcrumb]
//   [optional eyebrow]
//   <h1>Title</h1>            — sans semibold ~24px, tight tracking
//   [optional one-line description] [optional "as of" meta]
//                                                 [right-aligned actions]
// ---------------------------------------------------------------------------
export function PageHeader({
  title,
  description,
  eyebrow,
  meta,
  breadcrumb,
  actions,
  bordered = true,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  /** "as of timestamp" / data freshness slot, sits next to description. */
  meta?: React.ReactNode;
  /** Optional breadcrumb / back-link slot rendered above the eyebrow. */
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  /** Bottom border + bottom margin so page content sits 24px below. Default
   *  on. Pass `bordered={false}` for nested or compact headers. */
  bordered?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col md:flex-row md:items-start md:justify-between gap-3",
        bordered ? "border-b border-border pb-4 mb-6" : "",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {breadcrumb ? (
          <div className="mb-2 text-xs text-muted-foreground">{breadcrumb}</div>
        ) : null}
        {eyebrow ? (
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </div>
        ) : null}
        {/* Bumped title from text-xl/2xl → text-2xl/3xl so the page actually
            announces itself. Pre-fix the title sat at ~20px which made
            every page header feel like a section label, not the surface's
            primary identity. */}
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-tight">
          {title}
        </h1>
        {description || meta ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 max-w-3xl">
            {description ? (
              <p className="text-[13px] text-muted-foreground leading-snug">
                {description}
              </p>
            ) : null}
            {meta ? (
              <span className="text-[11px] text-muted-foreground/80 tabular-nums">
                {meta}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 flex-wrap md:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

// Unified section card used on detail pages. Subtle border, tight label row,
// optional trailing action slot.
export function SectionCard({
  label,
  description,
  action,
  children,
  className,
  padded = true,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card",
        padded ? "p-3" : "",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{label}</h2>
          {description ? (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
