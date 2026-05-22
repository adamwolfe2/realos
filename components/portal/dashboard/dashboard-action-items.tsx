"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  AlignLeft,
  ArrowRight,
  Bot,
  FileText,
  Flag,
  ImagePlus,
  MessageSquareWarning,
  MousePointerClick,
  RefreshCw,
  Search,
  Sparkles,
  Stars,
  TrendingDown,
  Upload,
  Video,
  X as XIcon,
} from "lucide-react";
import type { ProactiveAction } from "@/lib/intelligence/property-recommendations";

// ---------------------------------------------------------------------------
// DashboardActionItems — top portfolio-wide recommendations promoted to
// the main /portal dashboard. Dismiss-to-next-page (sessionStorage), not
// dismiss-forever — the same action will surface tomorrow if it's still
// the highest-priority gap.
//
// Renders as a clean strip directly below DashboardGreeting:
//
//   [✦] Action items · 3 high-impact tasks across your portfolio
//       ─────────────────────────────────────────────────────────
//       Telegraph Commons · Reply to 3 negative reviews          [Go →]
//       Telegraph Commons · Refresh "Downtown Berkeley" page     [Go →]
//       Telegraph Commons · Hero image missing                    [Go →]
//
// Each row is a single-click route into the exact surface to act.
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquareWarning,
  Flag,
  Stars,
  TrendingDown,
  Bot,
  Search,
  RefreshCw,
  Upload,
  FileText,
  MousePointerClick,
  ImagePlus,
  AlignLeft,
  Video,
  AlertTriangle,
  Sparkles,
};

const SEVERITY_DOT: Record<ProactiveAction["severity"], string> = {
  critical: "bg-destructive",
  high: "bg-amber-500",
  medium: "bg-primary",
  low: "bg-muted-foreground/60",
};

type PortfolioAction = ProactiveAction & {
  propertyName: string;
  propertyId: string;
};

const STORAGE_KEY = "ls.dashboard.actions.dismissed-ids";

export function DashboardActionItems({
  actions,
}: {
  actions: PortfolioAction[];
}) {
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) setDismissedIds(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  function dismiss(id: string) {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (!hydrated) return null;
  const visible = actions.filter((a) => !dismissedIds.has(a.id));
  if (visible.length === 0) return null;

  const headlineCount = visible.length;
  const criticalCount = visible.filter((a) => a.severity === "critical").length;
  const highCount = visible.filter((a) => a.severity === "high").length;

  return (
    <section
      aria-label="Recommended action items"
      className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/[0.04] overflow-hidden"
    >
      <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/60">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0 mt-0.5">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
                Action items
              </p>
              {criticalCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-red-400 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
                  <AlertCircle className="h-2.5 w-2.5" strokeWidth={2.5} />
                  {criticalCount} critical
                </span>
              ) : null}
              {highCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  <AlertCircle className="h-2.5 w-2.5" strokeWidth={2.5} />
                  {highCount} high
                </span>
              ) : null}
            </div>
            <h2 className="text-[13px] font-semibold text-foreground leading-tight">
              {headlineCount} high-impact task{headlineCount === 1 ? "" : "s"} across your portfolio
            </h2>
            <p className="text-[10.5px] text-muted-foreground mt-0.5">
              Synthesized from live signals. Sorted by impact × effort.
            </p>
          </div>
        </div>
      </header>

      <ol className="divide-y divide-border/60">
        {visible.slice(0, 3).map((action) => {
          const Icon = ICON_MAP[action.icon] ?? Sparkles;
          return (
            <li key={action.id}>
              <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${SEVERITY_DOT[action.severity]}`}
                />
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-muted-foreground">
                      {action.propertyName}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      ·
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {action.estimateMinutes} min
                    </span>
                  </div>
                  <p className="text-[12.5px] font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {action.title}
                  </p>
                </div>
                <Link
                  href={action.actionHref}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10.5px] font-semibold text-foreground hover:bg-muted hover:border-primary/30 transition-all"
                >
                  {action.actionLabel}
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <button
                  type="button"
                  onClick={() => dismiss(action.id)}
                  aria-label="Dismiss"
                  className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {visible.length > 3 ? (
        <Link
          href={
            visible[3]?.propertyId
              ? `/portal/properties/${visible[3].propertyId}#intelligence`
              : "/portal/properties"
          }
          className="block px-4 py-2 text-[11px] text-muted-foreground hover:text-foreground border-t border-border/60 hover:bg-muted/30 transition-colors text-center"
        >
          {visible.length - 3} more recommendation
          {visible.length - 3 === 1 ? "" : "s"} →
        </Link>
      ) : null}
    </section>
  );
}
