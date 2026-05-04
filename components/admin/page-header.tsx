import * as React from "react";
import { cn } from "@/lib/utils";

// Unified page header for /admin and /portal. Sans-serif, tight tracking,
// sentence-case title. Optional eyebrow (back link), description, actions row.
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col md:flex-row md:items-start md:justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[11px] text-muted-foreground mb-1">{eyebrow}</div>
        ) : null}
        <h1
          className="text-xl md:text-2xl font-medium tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h1>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2 flex-wrap">{actions}</div>
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
