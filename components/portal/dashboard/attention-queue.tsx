import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { EmptyState } from "@/components/portal/ui/empty-state";
import type { ProactiveAction } from "@/lib/intelligence/property-recommendations";
import type { InsightCardData } from "@/components/portal/insights/insight-card";

// ---------------------------------------------------------------------------
// AttentionQueue — the hero of the dashboard's right column. Merges the
// three text-heavy recommendation stacks that used to compete for
// attention as separate sections (Action items, SEO Agent, Insights) into
// one ranked list. Each source keeps its own upstream ordering; rows are
// concatenated action items -> SEO -> insights, then capped at 8 with a
// "View all" link into the insights page for the remainder. No new
// queries — every row's data was already fetched by the page for the
// three sections this replaces.
// ---------------------------------------------------------------------------

type PortfolioAction = ProactiveAction & {
  propertyName: string;
  propertyId: string;
};

type SeoActionItem = {
  id: string;
  title: string;
  estimateMinutes: number;
  actionHref: string | null;
  actionLabel: string | null;
  propertyName: string | null;
};

type Row = {
  id: string;
  source: "Task" | "SEO" | "Insight";
  title: string;
  propertyName?: string | null;
  meta?: string | null;
  href: string;
  actionLabel: string;
};

const MAX_ROWS = 8;

function fromActions(actions: PortfolioAction[]): Row[] {
  return actions.map((a) => ({
    id: `action-${a.id}`,
    source: "Task",
    title: a.title,
    propertyName: a.propertyName,
    meta: `${a.estimateMinutes} min`,
    href: a.actionHref,
    actionLabel: a.actionLabel,
  }));
}

function fromSeo(actions: SeoActionItem[]): Row[] {
  return actions.map((a) => ({
    id: `seo-${a.id}`,
    source: "SEO",
    title: a.title,
    propertyName: a.propertyName,
    meta: `~${a.estimateMinutes} min`,
    href: a.actionHref ?? "/portal/seo/agent",
    actionLabel: a.actionLabel ?? "Open",
  }));
}

function fromInsights(insights: InsightCardData[]): Row[] {
  return insights
    .filter((i) => i.severity === "critical" || i.severity === "warning")
    .map((i) => ({
      id: `insight-${i.id}`,
      source: "Insight",
      title: i.title,
      propertyName: i.property?.name ?? null,
      meta: null,
      href: i.href ?? "/portal/insights",
      actionLabel: "Open",
    }));
}

const SOURCE_PILL: Record<Row["source"], string> = {
  Task: "ls-pill ls-pill-neutral",
  SEO: "ls-pill ls-pill-info",
  Insight: "ls-pill ls-pill-warning",
};

export function AttentionQueue({
  actions,
  seoActions,
  insights,
  showPropertyTag,
}: {
  actions: PortfolioAction[];
  seoActions: SeoActionItem[];
  insights: InsightCardData[];
  /** Only show the per-row property tag when the org has 2+ properties —
   *  a single-property org already knows which building this is. */
  showPropertyTag: boolean;
}) {
  const all = [
    ...fromActions(actions),
    ...fromSeo(seoActions),
    ...fromInsights(insights),
  ];

  if (all.length === 0) {
    return (
      <EmptyState
        icon={<CircleCheck className="w-[18px] h-[18px]" />}
        title="Nothing needs attention right now."
        body="Recommendations from the Intelligence engine, the SEO agent, and detected insights will show up here as they come in."
        variant="card"
      />
    );
  }

  const visible = all.slice(0, MAX_ROWS);
  const remainder = all.length - visible.length;

  return (
    <div className="ls-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--hair)]">
        <h2 className="text-[13px] font-semibold text-foreground leading-tight">
          Needs your attention
        </h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {all.length}
        </span>
      </header>
      <ul className="divide-y divide-[var(--hair)]">
        {visible.map((row) => (
          <li key={row.id}>
            <div className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span className={SOURCE_PILL[row.source]}>{row.source}</span>
                  {showPropertyTag && row.propertyName ? (
                    <>
                      <span className="text-[10px] text-muted-foreground/60">
                        ·
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-muted-foreground truncate">
                        {row.propertyName}
                      </span>
                    </>
                  ) : null}
                  {row.meta ? (
                    <>
                      <span className="text-[10px] text-muted-foreground/60">
                        ·
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {row.meta}
                      </span>
                    </>
                  ) : null}
                </div>
                <p className="text-[13px] font-medium text-foreground truncate">
                  {row.title}
                </p>
              </div>
              <Link
                href={row.href}
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                {row.actionLabel}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <Link
        href="/portal/insights"
        className="flex items-center justify-center gap-1 px-4 py-2 text-[11px] text-muted-foreground hover:text-foreground border-t border-[var(--hair)] hover:bg-muted/30 transition-colors"
      >
        {remainder > 0 ? `${remainder} more · ` : ""}View all
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  );
}
