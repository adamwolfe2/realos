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
    container: string;
    iconClass: string;
    actionClass: string;
  }
> = {
  info: {
    icon: Info,
    container: "bg-[#EFF6FF] border-[#DBEAFE] text-[#1E3A8A]",
    iconClass: "text-[#2563EB]",
    actionClass: "text-[#2563EB] hover:text-[#1D4ED8]",
  },
  success: {
    icon: CheckCircle2,
    container: "bg-[#F0FDF4] border-[#DCFCE7] text-[#14532D]",
    iconClass: "text-[#16A34A]",
    actionClass: "text-[#15803D] hover:text-[#14532D]",
  },
  warning: {
    icon: AlertTriangle,
    container: "bg-[#FFFBEB] border-[#FEF3C7] text-[#78350F]",
    iconClass: "text-[#F59E0B]",
    actionClass: "text-[#B45309] hover:text-[#78350F]",
  },
  critical: {
    icon: AlertCircle,
    container: "bg-[#FEF2F2] border-[#FEE2E2] text-[#7F1D1D]",
    iconClass: "text-[#DC2626]",
    actionClass: "text-[#B91C1C] hover:text-[#7F1D1D]",
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
          ? "shrink-0 border-b text-[11.5px] px-4 h-7 flex items-center gap-2 leading-none"
          : "border px-4 py-2.5 text-sm flex items-center gap-3 rounded-md",
        tokens.container,
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
