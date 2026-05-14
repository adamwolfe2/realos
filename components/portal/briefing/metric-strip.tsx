import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Metric = {
  label: string;
  value: string;
  deltaPct: number | null;
  good: "up" | "down";
};

export function MetricStrip({
  metrics,
}: {
  metrics: {
    leads: { current: number; deltaPct: number | null };
    tours: { current: number; deltaPct: number | null };
    applications: { current: number; deltaPct: number | null };
    adSpendUsd: { current: number; deltaPct: number | null };
    organicSessions: { current: number; deltaPct: number | null };
    chatbotConversations: { current: number; deltaPct: number | null };
  };
}) {
  const rows: Metric[] = [
    {
      label: "Leads",
      value: metrics.leads.current.toLocaleString(),
      deltaPct: metrics.leads.deltaPct,
      good: "up",
    },
    {
      label: "Tours",
      value: metrics.tours.current.toLocaleString(),
      deltaPct: metrics.tours.deltaPct,
      good: "up",
    },
    {
      label: "Applications",
      value: metrics.applications.current.toLocaleString(),
      deltaPct: metrics.applications.deltaPct,
      good: "up",
    },
    {
      label: "Ad spend",
      value: `$${metrics.adSpendUsd.current.toLocaleString()}`,
      deltaPct: metrics.adSpendUsd.deltaPct,
      good: "down",
    },
    {
      label: "Organic",
      value: metrics.organicSessions.current.toLocaleString(),
      deltaPct: metrics.organicSessions.deltaPct,
      good: "up",
    },
    {
      label: "Chat conv.",
      value: metrics.chatbotConversations.current.toLocaleString(),
      deltaPct: metrics.chatbotConversations.deltaPct,
      good: "up",
    },
  ];

  // Premium-pass: 3-column grid on md+, 2-column on small. Each metric
  // now renders with bigger typography + a delta chip below the value
  // so the morning briefing feels like a real KPI surface rather than
  // a "label · value · pct" inline row.
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
      {rows.map((r) => (
        <MetricRow key={r.label} metric={r} />
      ))}
    </div>
  );
}

function MetricRow({ metric }: { metric: Metric }) {
  const deltaTone = toneFor(metric.deltaPct, metric.good);
  const Icon =
    metric.deltaPct === null
      ? Minus
      : metric.deltaPct > 0
        ? ArrowUpRight
        : metric.deltaPct < 0
          ? ArrowDownRight
          : Minus;

  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground truncate">
        {metric.label}
      </div>
      <div className="flex items-baseline justify-between gap-2 mt-1">
        <span className="text-xl font-semibold tabular-nums tracking-tight text-foreground leading-none">
          {metric.value}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shrink-0",
            deltaTone,
          )}
        >
          <Icon className="h-2.5 w-2.5" />
          {metric.deltaPct === null
            ? "new"
            : `${metric.deltaPct >= 0 ? "+" : ""}${metric.deltaPct}%`}
        </span>
      </div>
    </div>
  );
}

function toneFor(delta: number | null, good: "up" | "down") {
  if (delta === null) return "text-muted-foreground bg-muted";
  if (delta === 0) return "text-muted-foreground bg-muted";
  const isGood = good === "up" ? delta > 0 : delta < 0;
  return isGood
    ? "text-primary bg-primary/10"
    : "text-muted-foreground bg-muted";
}
