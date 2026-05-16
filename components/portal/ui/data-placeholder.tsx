import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// DataPlaceholder — the canonical "this surface is waiting on data"
// affordance. Replaces the assortment of bare "—", "0", and blank cards
// that make a partially-connected portfolio look broken.
//
// Three intents:
//   • connect  — the source isn't wired yet (default). Renders a primary
//                CTA with the supplied href ("Connect Google Ads →").
//   • waiting  — wired but data hasn't landed yet ("Syncing now…").
//   • empty    — wired and synced but nothing to show yet ("No mentions
//                yet — run a scan").
//
// The visual is intentionally inviting rather than apologetic — a soft
// dashed border, brand-tinted icon square, short headline, and a single
// CTA. Pages drop it in wherever they currently render dashes.
// ---------------------------------------------------------------------------

type Intent = "connect" | "waiting" | "empty";

type Props = {
  intent?: Intent;
  /** Lucide icon (or any node) — sits in the brand-tinted square. */
  icon?: React.ReactNode;
  /** Short headline. Sentence case. */
  title: React.ReactNode;
  /** One-line body explaining what data lands here. */
  body?: React.ReactNode;
  /** Single CTA. Use `connect` intent for cross-page connect flows. */
  action?: { label: string; href: string };
  /** Compact variant for tight grid cells. Drops body + icon. */
  compact?: boolean;
  className?: string;
};

const INTENT_BORDER: Record<Intent, string> = {
  connect: "border-dashed border-primary/30",
  waiting: "border-dashed border-amber-300/60",
  empty: "border-dashed border-border",
};

const INTENT_ICON_TONE: Record<Intent, string> = {
  connect: "bg-primary/10 text-primary",
  waiting: "bg-amber-100 text-amber-700",
  empty: "bg-muted text-muted-foreground",
};

export function DataPlaceholder({
  intent = "connect",
  icon,
  title,
  body,
  action,
  compact,
  className,
}: Props) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-md border bg-card/50 px-3 py-2",
          INTENT_BORDER[intent],
          className,
        )}
      >
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-foreground truncate">
            {title}
          </div>
        </div>
        {action ? (
          <Link
            href={action.href}
            className="shrink-0 text-[11px] font-semibold text-primary hover:underline whitespace-nowrap"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card/40 px-4 py-6 text-center flex flex-col items-center gap-2",
        INTENT_BORDER[intent],
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "mb-1 inline-flex h-9 w-9 items-center justify-center rounded-md",
            INTENT_ICON_TONE[intent],
          )}
        >
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {body ? (
        <p className="max-w-sm text-[12px] text-muted-foreground leading-snug">
          {body}
        </p>
      ) : null}
      {action ? (
        <Link
          href={action.href}
          className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary-dark transition-colors"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
