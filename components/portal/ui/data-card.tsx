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
        // Premium primitive — ls-card gives us layered depth + inner highlight
        // + hover lift baked into the design system.
        "ls-card flex flex-col",
        className,
      )}
    >
      {hasHeader ? (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-[var(--hair)]">
          <div className="min-w-0">
            {eyebrow ? (
              <div className="ls-eyebrow mb-1">{eyebrow}</div>
            ) : null}
            {title ? (
              <h2
                className="text-[15px] font-semibold tracking-tight text-foreground leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-[12px] text-muted-foreground leading-snug">
                {description}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {action}
            {href ? (
              <Link
                href={href}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground hover:text-primary transition-colors"
              >
                {hrefLabel}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </header>
      ) : null}
      <div className={cn(flush ? "" : "px-5 pb-4 pt-3", "flex-1")}>
        {children}
      </div>
    </section>
  );
}
