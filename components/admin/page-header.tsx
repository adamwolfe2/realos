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
        "relative flex flex-col md:flex-row md:items-start md:justify-between gap-3",
        bordered ? "pb-5 mb-6 border-b border-[var(--hair)]" : "",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {breadcrumb ? (
          <div className="mb-2 text-xs text-muted-foreground">{breadcrumb}</div>
        ) : null}
        {eyebrow ? (
          <div className="ls-eyebrow mb-2" style={{ color: "var(--terracotta)" }}>
            {eyebrow}
          </div>
        ) : null}
        {/* Premium 2026 redesign: page title is now the visual anchor of the
            page. Bumped to text-[28px] / md:text-[34px], tighter tracking,
            and the description below is restrained so the title dominates. */}
        <h1
          className="text-[28px] md:text-[34px] font-semibold tracking-[-0.022em] text-foreground leading-[1.08]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h1>
        {description || meta ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 max-w-3xl">
            {description ? (
              <p className="text-[13.5px] text-muted-foreground leading-relaxed">
                {description}
              </p>
            ) : null}
            {meta ? (
              <span className="text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-full" style={{ background: "var(--color-elevated)", color: "var(--olive-gray)", fontFamily: "var(--font-mono)" }}>
                {meta}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 flex-wrap md:justify-end pt-1">
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
        "ls-card",
        padded ? "p-5" : "",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2
            className="text-[14px] font-semibold tracking-tight text-foreground leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {label}
          </h2>
          {description ? (
            <p className="text-[11.5px] text-muted-foreground mt-1 leading-snug">
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
