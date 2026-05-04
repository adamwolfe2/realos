import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// DataCard — the single card primitive used across every dashboard surface.
// Replaces the dozens of ad-hoc `rounded-lg border bg-card` blocks scattered
// across the portal. Header is optional; eyebrow/title/description follow
// the same rhythm as DashboardSection but with tighter padding tuned for
// dense layouts. Token-driven so the marketing-site cream palette flows
// through automatically.
// ---------------------------------------------------------------------------

export type DataCardProps = {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** When true, removes inner padding so children control it (used for tables). */
  flush?: boolean;
};

export function DataCard({
  eyebrow,
  title,
  description,
  href,
  hrefLabel = "View all",
  action,
  children,
  className,
  flush,
}: DataCardProps) {
  const hasHeader = eyebrow || title || description || action || href;
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card flex flex-col",
        className,
      )}
    >
      {hasHeader ? (
        <header className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
          <div className="min-w-0">
            {eyebrow ? (
              <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground mb-0.5">
                {eyebrow}
              </div>
            ) : null}
            {title ? (
              <h2
                className="text-[15px] font-medium tracking-tight text-foreground leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                {description}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {action}
            {href ? (
              <Link
                href={href}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                {hrefLabel}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </header>
      ) : null}
      <div className={cn(flush ? "" : "px-4 pb-3 pt-1", "flex-1")}>
        {children}
      </div>
    </section>
  );
}
