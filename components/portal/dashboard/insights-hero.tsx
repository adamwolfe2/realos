import Link from "next/link";
import { Sparkles, ArrowRight, Plug } from "lucide-react";
import { InsightCard, type InsightCardData } from "@/components/portal/insights/insight-card";

// ---------------------------------------------------------------------------
// InsightsHero — the dashboard centerpiece.
//
// Renders the top 3 ranked open insights as a hero card. When the org has
// no insights yet (brand-new tenant, no data connected) it renders an
// empty-state coaching block that drives users to /portal/connect — the
// fastest path to first insight.
//
// The component is a server component (it accepts props from the page
// server-component) but the child InsightCard is a client component for
// the acknowledge / dismiss / snooze / mark-acted actions.
// ---------------------------------------------------------------------------

type Props = {
  insights: InsightCardData[];
  counts: { critical: number; warning: number; info: number; total: number };
  /** How many of the 7 data sources the org has connected. Drives the
      empty-state copy ("Connect your first source" vs "Add 2 more"). */
  sourcesConnected: number;
  totalSources: number;
};

export function InsightsHero({
  insights,
  counts,
  sourcesConnected,
  totalSources,
}: Props) {
  // Empty state — no insights yet. Either the org has no data connected
  // OR the detectors haven't found anything actionable yet (best-case
  // scenario for the operator).
  if (counts.total === 0) {
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
            <h2
              className="text-[20px] lg:text-[22px] font-semibold tracking-tight text-foreground leading-snug"
              style={{
                fontFamily:
                  "var(--font-fraunces, Georgia, 'Times New Roman', serif)",
              }}
            >
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

  // Active state — render the top 3 insights as the centerpiece.
  return (
    <section className="rounded-xl border border-border bg-card p-4 lg:p-5">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
            <Sparkles className="w-3 h-3" />
            Insights
          </p>
          <h2
            className="text-[18px] lg:text-[20px] font-semibold tracking-tight text-foreground leading-snug mt-1"
            style={{
              fontFamily:
                "var(--font-fraunces, Georgia, 'Times New Roman', serif)",
            }}
          >
            {counts.critical > 0
              ? `${counts.critical} critical · ${counts.warning} warning · ${counts.info} info`
              : counts.warning > 0
                ? `${counts.warning} warning · ${counts.info} info`
                : `${counts.info} insight${counts.info === 1 ? "" : "s"} from your data`}
          </h2>
        </div>
        <Link
          href="/portal/insights"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline whitespace-nowrap shrink-0"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {insights.slice(0, 3).map((insight) => (
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
