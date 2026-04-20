import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// DashboardSection
//
// A unified container for the medium / large dashboard cards (lead source
// donut, conversion funnel, properties grid, activity feed). Same warm
// border + ivory surface as KpiTile but with a header row that includes
// title, optional eyebrow / description, and an optional "view all" link.
// ---------------------------------------------------------------------------

export function DashboardSection({
  title,
  eyebrow,
  description,
  href,
  hrefLabel = "View all",
  action,
  children,
  className,
  contentClassName,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)] flex flex-col",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)] mb-1">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="text-base font-semibold tracking-tight text-[var(--near-black)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-[var(--olive-gray)]">{description}</p>
          ) : null}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {action}
          {href ? (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--near-black)] hover:text-[var(--terracotta)] transition-colors"
            >
              {hrefLabel}
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </header>
      <div className={cn("p-5 pt-4 flex-1", contentClassName)}>{children}</div>
    </section>
  );
}
