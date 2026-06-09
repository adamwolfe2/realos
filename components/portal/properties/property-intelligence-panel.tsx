import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { ProactiveAction } from "@/lib/intelligence/property-recommendations";

// ---------------------------------------------------------------------------
// PropertyIntelligencePanel — renders below the PropertyHeroBanner on a
// property detail page. Synthesizes the ProactiveAction[] from the
// intelligence engine into a grouped, scannable list of "do these things
// this week" cards. Operator clicks any card to land in the exact
// surface to act.
//
// Norman 2026-05-21 vision: "Proactive and ACTUALLY ACTIONABLE based on
// real data." Every card here is computed from a Prisma query — no
// hand-curated copy, no placeholder advice.
// ---------------------------------------------------------------------------

const CATEGORY_LABEL: Record<ProactiveAction["category"], string> = {
  seo: "SEO",
  aeo: "AEO",
  reputation: "Reputation",
  content_freshness: "Content freshness",
  listing: "Listing",
  competitor: "Competitor",
};

// Enterprise-blue severity treatment. Severity reads from primary
// saturation (densest = critical, dimmest = low) + a thin dot rather
// than from hue (red/amber/yellow). Keeps the intelligence panel
// cohesive with the marketplace, AEO cards, and recommendation queue
// — no more amber/coral surfaces breaking the single-blue rhythm.
const SEVERITY_STYLES: Record<
  ProactiveAction["severity"],
  { dot: string; pill: string; ring: string }
> = {
  critical: {
    dot: "bg-primary",
    pill: "bg-primary text-primary-foreground",
    ring: "ring-primary/30",
  },
  high: {
    dot: "bg-primary/70",
    pill: "bg-primary/15 text-primary",
    ring: "ring-primary/20",
  },
  medium: {
    dot: "bg-primary/40",
    pill: "bg-muted text-foreground",
    ring: "ring-border",
  },
  low: {
    dot: "bg-muted-foreground/40",
    pill: "bg-background text-muted-foreground",
    ring: "ring-border",
  },
};

type Props = {
  propertyName: string;
  actions: ProactiveAction[];
};

export function PropertyIntelligencePanel({ propertyName, actions }: Props) {
  if (actions.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-gradient-to-br from-card to-primary/[0.04] p-5">
        <header className="flex items-center gap-2.5 mb-1">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold text-foreground">
            All clear at {propertyName}
          </h2>
        </header>
        <p className="text-xs text-muted-foreground pl-8.5">
          No outstanding recommendations right now. We'll surface new ones as
          data flows in (next intelligence sweep runs at 03:00 UTC).
        </p>
      </section>
    );
  }

  // Pull the top 5 for the headline list, then group the remainder by
  // category for "more recommendations" below the fold.
  const top = actions.slice(0, 5);
  const rest = actions.slice(5);
  const restByCategory = rest.reduce<Record<string, ProactiveAction[]>>(
    (acc, a) => {
      (acc[a.category] ||= []).push(a);
      return acc;
    },
    {},
  );

  // Severity counters for the header summary chip.
  const counts = actions.reduce(
    (acc, a) => {
      acc[a.severity] = (acc[a.severity] ?? 0) + 1;
      return acc;
    },
    {} as Record<ProactiveAction["severity"], number>,
  );

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-3.5 py-2 border-b border-border bg-gradient-to-br from-card to-primary/[0.04]">
        <div className="min-w-0 flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
            <Sparkles className="h-3 w-3" />
          </span>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-primary shrink-0">
            Intelligence
          </p>
          <span aria-hidden="true" className="h-3 w-px bg-border" />
          <h2 className="text-[12px] font-semibold text-foreground leading-tight truncate">
            {actions.length} action{actions.length === 1 ? "" : "s"} for{" "}
            {propertyName}
          </h2>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {counts.critical ? (
            <SeverityChip
              count={counts.critical}
              label="Critical"
              severity="critical"
            />
          ) : null}
          {counts.high ? (
            <SeverityChip count={counts.high} label="High" severity="high" />
          ) : null}
          {counts.medium ? (
            <SeverityChip
              count={counts.medium}
              label="Medium"
              severity="medium"
            />
          ) : null}
        </div>
      </header>

      <ol className="divide-y divide-border">
        {top.map((action) => (
          <ActionRow key={action.id} action={action} />
        ))}
      </ol>

      {rest.length > 0 ? (
        <details className="border-t border-border bg-muted/20">
          <summary className="cursor-pointer px-5 py-3 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
            <ArrowRight className="h-3.5 w-3.5 transition-transform [details[open]>&]:rotate-90" />
            {rest.length} more recommendation{rest.length === 1 ? "" : "s"}
          </summary>
          <div className="px-5 pb-4 space-y-3">
            {Object.entries(restByCategory).map(([category, items]) => (
              <div key={category}>
                <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
                  {CATEGORY_LABEL[category as ProactiveAction["category"]]}
                </p>
                <ol className="space-y-1.5">
                  {items.map((action) => (
                    <ActionRow key={action.id} action={action} compact />
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function SeverityChip({
  count,
  label,
  severity,
}: {
  count: number;
  label: string;
  severity: ProactiveAction["severity"];
}) {
  const styles = SEVERITY_STYLES[severity];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles.pill}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}
      />
      {count} {label}
    </span>
  );
}

function ActionRow({
  action,
  compact = false,
}: {
  action: ProactiveAction;
  compact?: boolean;
}) {
  const styles = SEVERITY_STYLES[action.severity];

  if (compact) {
    return (
      <li>
        <Link
          href={action.actionHref}
          className={`flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2 ring-1 ${styles.ring}`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${styles.dot}`}
          />
          <span className="text-[12px] font-medium text-foreground flex-1 min-w-0 truncate">
            {action.title}
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {action.estimateMinutes} min
          </span>
          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
        </Link>
      </li>
    );
  }

  return (
    <li>
      <div className="flex items-center gap-2.5 px-3.5 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 flex-wrap leading-none mb-0.5">
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${styles.pill}`}
            >
              {action.severity}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
              {CATEGORY_LABEL[action.category]}
            </span>
            <span className="text-[9.5px] text-muted-foreground tabular-nums">
              · {action.estimateMinutes} min
            </span>
          </div>
          <p className="text-[12px] font-semibold text-foreground leading-snug truncate">
            {action.title}
          </p>
        </div>
        <Link
          href={action.actionHref}
          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-2 py-1 text-[10.5px] font-semibold hover:bg-primary-dark transition-colors"
        >
          {action.actionLabel}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </li>
  );
}
