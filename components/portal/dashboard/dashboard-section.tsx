import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
        "rounded-lg border border-border bg-card flex flex-col",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground mb-0.5">
              {eyebrow}
            </div>
          ) : null}
          <h2
            className="text-[15px] font-medium tracking-tight text-foreground leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h2>
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
      <div className={cn("px-4 pb-3 pt-3 flex-1", contentClassName)}>{children}</div>
    </section>
  );
}
