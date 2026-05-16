import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// EmptyState — single primitive for "no data yet" surfaces. Centered icon
// + headline + body + optional CTA. Replaces the inconsistent assortment of
// hand-rolled empty states across pages. Uses cream-canvas tones so the
// surface fades naturally into the dashboard.
// ---------------------------------------------------------------------------

type Props = {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: { label: string; href: string };
  secondary?: { label: string; href: string };
  className?: string;
  /** "card" wraps the empty in a subtle bordered card; "bare" sits inline. */
  variant?: "card" | "bare";
};

export function EmptyState({
  icon,
  title,
  body,
  action,
  secondary,
  className,
  variant = "card",
}: Props) {
  return (
    <div
      className={cn(
        variant === "card"
          ? "rounded-xl border border-dashed border-border bg-secondary/40"
          : "",
        "px-4 py-8 text-center flex flex-col items-center gap-1.5",
        className,
      )}
    >
      {icon ? (
        <div className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {body ? (
        <p className="max-w-sm text-[11px] text-muted-foreground leading-snug">
          {body}
        </p>
      ) : null}
      {action || secondary ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          {action ? (
            <Link
              href={action.href}
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary-dark transition-colors"
            >
              {action.label}
            </Link>
          ) : null}
          {secondary ? (
            <Link
              href={secondary.href}
              className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              {secondary.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
