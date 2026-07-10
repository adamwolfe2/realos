import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import { InsightCard, type InsightCardData } from "@/components/portal/insights/insight-card";
import { EmptyState } from "@/components/portal/ui/empty-state";

// ---------------------------------------------------------------------------
// InsightsHero — the dashboard centerpiece, also reused on per-property
// pages for the same insight surface filtered to one property.
//
// Two scope modes:
//   - "portfolio" (default) → drives /portal/connect when empty, links to
//     /portal/insights for view-all.
//   - { propertyId, propertyName } → empty state stays calm ("no insights
//     for this property right now"), links to /portal/insights filtered to
//     this property for view-all.
//
// Server component — child InsightCard handles the acknowledge / dismiss /
// snooze / mark-acted client actions.
// ---------------------------------------------------------------------------

type Scope =
  | "portfolio"
  | { kind: "property"; propertyId: string; propertyName: string };

type Props = {
  insights: InsightCardData[];
  counts: { critical: number; warning: number; info: number; total: number };
  /** How many of the 7 data sources the org has connected. Drives the
      empty-state copy on portfolio scope. Ignored when scope is property. */
  sourcesConnected?: number;
  totalSources?: number;
  scope?: Scope;
};

export function InsightsHero({
  insights,
  counts,
  sourcesConnected = 0,
  totalSources = 7,
  scope = "portfolio",
}: Props) {
  const isProperty = scope !== "portfolio" && scope.kind === "property";
  const propertyName = isProperty ? scope.propertyName : null;
  const propertyId = isProperty ? scope.propertyId : null;
  const viewAllHref = isProperty
    ? `/portal/insights?property=${propertyId}`
    : "/portal/insights";

  // Empty state — tone differs by scope. Portfolio nudges to /portal/connect;
  // property scope just says "nothing actionable right now."
  if (counts.total === 0) {
    if (isProperty) {
      return (
        <section className="rounded-[2px] border border-border bg-muted/30 p-4 lg:p-5">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#525252]">
              Insights
            </p>
            <h2 className="text-[16px] font-semibold text-foreground mt-0.5">
              Nothing to action at {propertyName} right now.
            </h2>
            <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
              We&apos;ll surface insights here as soon as detectors find an
              actionable pattern in this property&apos;s data. Vacancy
              concentration, ad-spend anomalies, renewal cliffs, negative
              reviews, and more.
            </p>
          </div>
        </section>
      );
    }
    // Portfolio scope — EmptyState primitive with a ghost connect action.
    // The onboarding stepper owns the primary connect CTA; this surface
    // only offers a quiet secondary route to /portal/connect.
    return (
      <EmptyState
        icon={<Lightbulb className="w-[18px] h-[18px]" />}
        title={
          sourcesConnected === 0
            ? "Connect your first data source to start receiving insights."
            : sourcesConnected < totalSources
              ? `${sourcesConnected} of ${totalSources} sources connected.`
              : "All sources connected."
        }
        body={
          sourcesConnected === 0
            ? "Connect AppFolio, Google Analytics, Search Console, your ad accounts, and the pixel. Each unlocks a new family of insights."
            : sourcesConnected < totalSources
              ? "Keep adding sources to unlock more insight categories. Reputation alerts need your website; ad-spend insights need Google or Meta Ads; renewal cliffs need AppFolio."
              : "Analysis runs as new data lands. Insights appear here when actionable patterns show up in your data."
        }
        secondary={
          sourcesConnected < totalSources
            ? { label: "Connect data", href: "/portal/connect" }
            : undefined
        }
      />
    );
  }

  // Active state. If there's only info-level chatter (no critical or
  // warning), collapse to a single-line strip rather than three cards.
  // The 3-card layout is reserved for genuinely actionable signal so the
  // page reads premium instead of like a worklist.
  const hasActionable = counts.critical > 0 || counts.warning > 0;

  if (!hasActionable) {
    return (
      <section className="rounded-[2px] border border-border bg-card px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#525252]">
              {isProperty ? `Insights for ${propertyName}` : "Insights"}
            </p>
            <span className="text-[11.5px] tabular-nums text-muted-foreground">
              {counts.info} info {counts.info === 1 ? "signal" : "signals"} &middot; nothing urgent
            </span>
          </div>
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:underline whitespace-nowrap shrink-0"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[2px] border border-border bg-card p-4 lg:p-5">
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#525252]">
            {isProperty ? `Insights for ${propertyName}` : "Insights"}
          </p>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {counts.total} signal{counts.total === 1 ? "" : "s"} this period
          </span>
        </div>
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:underline whitespace-nowrap shrink-0"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {insights
          // Only surface actionable cards at the top. Info-level insights
          // are accessible via the View-all link.
          .filter((i) => i.severity === "critical" || i.severity === "warning")
          .slice(0, 3)
          .map((insight) => (
            <InsightCard
              key={insight.id}
              insight={{
                ...insight,
                context: (insight.context as Record<string, unknown>) ?? null,
              }}
              dense
            />
          ))}
      </div>
    </section>
  );
}
