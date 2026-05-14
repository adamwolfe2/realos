import Link from "next/link";
import { Sparkles, ArrowRight, Plug } from "lucide-react";
import { InsightCard, type InsightCardData } from "@/components/portal/insights/insight-card";

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
        <section className="rounded-xl border border-border bg-muted/30 p-4 lg:p-5">
          <div className="flex items-start gap-3">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary shrink-0">
              <Sparkles className="w-[18px] h-[18px]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
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
          </div>
        </section>
      );
    }
    // Portfolio scope — drive to /portal/connect.
    return (
      <section className="rounded-xl border border-primary/20 bg-primary/[0.03] p-5 lg:p-6">
        <div className="flex items-start gap-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 text-primary shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary mb-1">
              Insights
            </p>
            <h2 className="text-[20px] lg:text-[22px] font-semibold tracking-tight text-foreground leading-snug">
              {sourcesConnected === 0
                ? "Connect your first data source to start receiving insights."
                : sourcesConnected < totalSources
                  ? `${sourcesConnected} of ${totalSources} sources connected. Insights flow within minutes of each connection.`
                  : "All sources connected. We'll surface insights here as soon as actionable patterns appear in your data."}
            </h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">
              {sourcesConnected === 0
                ? "Plug in AppFolio, Google Analytics, Search Console, your ad accounts, and the Cursive pixel. Each unlocks a new family of insights — from CPL spikes to vacancy alerts to cross-property benchmarks."
                : sourcesConnected < totalSources
                  ? "Keep adding sources to unlock more insight categories. Reputation alerts need your website connected; ad-spend insights need Google or Meta Ads; renewal cliffs need AppFolio."
                  : "We run our analysis the moment new data lands — no scheduled reports, no overnight delays. Sit tight while detectors complete their first pass."}
            </p>
            {sourcesConnected < totalSources ? (
              <Link
                href="/portal/connect"
                className="inline-flex items-center gap-1.5 mt-4 h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-dark transition-colors"
              >
                <Plug className="w-3.5 h-3.5" />
                Connect data
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  // Active state. If there's only info-level chatter (no critical or
  // warning), collapse to a single-line strip rather than three cards.
  // The 3-card layout is reserved for genuinely actionable signal so the
  // page reads premium instead of like a worklist.
  const hasActionable = counts.critical > 0 || counts.warning > 0;

  if (!hasActionable) {
    return (
      <section className="rounded-lg border border-border bg-card px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-3 h-3 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
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
    <section className="rounded-xl border border-border bg-card p-4 lg:p-5">
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="w-3 h-3" />
            {isProperty ? `Insights for ${propertyName}` : "Insights"}
          </p>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {[
              counts.critical > 0 ? `${counts.critical} critical` : null,
              counts.warning > 0 ? `${counts.warning} warning` : null,
              counts.info > 0 ? `${counts.info} info` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
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
