import * as React from "react";
import Link from "next/link";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// AlertBanner — single primitive for inline page banners (data-stale,
// integration-failed, trial-expiring, success confirmations, etc.). Replaces
// the ad-hoc red/amber/blue bordered divs that each page invented.
//
// Severity tokens map to a controlled palette:
//   info     → muted blue tint
//   success  → green tint
//   warning  → amber tint
//   critical → red tint
//
// The banner renders as a thin, readable strip, not a giant blocking card.
// Use the global stale-data banner in PortalLayout for portfolio-wide alerts.
// ---------------------------------------------------------------------------

export type AlertSeverity = "info" | "success" | "warning" | "critical";

const SEVERITY_TOKENS: Record<
  AlertSeverity,
  {
    icon: React.ComponentType<{ className?: string }>;
    /** Used for the flush (slim chrome strip) variant. */
    container: string;
    iconClass: string;
    actionClass: string;
    /** Used for the inline (card-shaped) variant — pairs with `.ls-alert`. */
    cardClass: string;
  }
> = {
  info: {
    icon: Info,
    container: "bg-blue-50 border-blue-200 text-blue-900",
    iconClass: "text-blue-600",
    actionClass: "text-blue-600 hover:text-blue-700",
    cardClass: "ls-alert ls-alert-info text-slate-800",
  },
  success: {
    icon: CheckCircle2,
    container: "bg-green-50 border-green-200 text-green-900",
    iconClass: "text-green-600",
    actionClass: "text-green-700 hover:text-green-900",
    cardClass: "ls-alert ls-alert-success text-slate-800",
  },
  warning: {
    icon: AlertTriangle,
    container: "bg-amber-50 border-amber-200 text-amber-900",
    iconClass: "text-amber-500",
    actionClass: "text-amber-700 hover:text-amber-900",
    cardClass: "ls-alert ls-alert-warning text-slate-800",
  },
  critical: {
    icon: AlertCircle,
    container: "bg-red-50 border-red-200 text-red-900",
    iconClass: "text-red-600",
    actionClass: "text-red-700 hover:text-red-900",
    cardClass: "ls-alert ls-alert-critical text-slate-800",
  },
};

type Action =
  | { label: string; href: string; onClick?: undefined }
  | { label: string; onClick: () => void; href?: undefined };

type Props = {
  severity?: AlertSeverity;
  title?: React.ReactNode;
  /** Optional body — shorter than the title for inline strip layout. */
  children?: React.ReactNode;
  action?: Action;
  /** Render as a dismissible banner. Caller owns the dismissed state. */
  onDismiss?: () => void;
  className?: string;
  /** Render with no rounded corners — used by PortalLayout as a full-bleed
   *  strip so the banner reads as page chrome rather than content. */
  flush?: boolean;
};

export function AlertBanner({
  severity = "info",
  title,
  children,
  action,
  onDismiss,
  className,
  flush,
}: Props) {
  const tokens = SEVERITY_TOKENS[severity];
  const Icon = tokens.icon;

  // When rendered flush (full-bleed page chrome), use a slim 28px strip
  // matching the impersonation banner. Inline (non-flush) usage keeps the
  // taller card treatment for in-page callouts.
  return (
    <div
      role={severity === "critical" ? "alert" : "status"}
      className={cn(
        flush
          ? cn(
              "shrink-0 border-b text-[11.5px] px-4 h-7 flex items-center gap-2 leading-none",
              tokens.container,
            )
          : cn(
              "text-sm flex items-center gap-3",
              tokens.cardClass,
            ),
        className,
      )}
    >
      <Icon
        className={cn(
          flush ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0",
          tokens.iconClass,
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          "flex-1 min-w-0 flex items-baseline gap-x-2 gap-y-0.5",
          flush ? "flex-nowrap truncate" : "flex-wrap",
        )}
      >
        {title ? (
          <span className="font-semibold leading-snug truncate">{title}</span>
        ) : null}
        {children ? (
          <span
            className={cn(
              "opacity-90 leading-snug truncate",
              flush ? "text-[11.5px]" : "text-[13px]",
            )}
          >
            {children}
          </span>
        ) : null}
      </div>
      {action ? (
        action.href ? (
          <Link
            href={action.href}
            className={cn(
              "shrink-0 font-semibold underline underline-offset-2 hover:no-underline whitespace-nowrap",
              flush ? "text-[11.5px]" : "text-xs",
              tokens.actionClass,
            )}
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className={cn(
              "shrink-0 font-semibold underline underline-offset-2 hover:no-underline whitespace-nowrap",
              flush ? "text-[11.5px]" : "text-xs",
              tokens.actionClass,
            )}
          >
            {action.label}
          </button>
        )
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            "shrink-0 rounded p-1 hover:bg-black/5 transition-colors",
            tokens.iconClass,
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
