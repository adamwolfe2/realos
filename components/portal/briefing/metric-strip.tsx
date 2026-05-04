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

  // 2-column grid — stacks the six metrics into 3 rows of 2 instead of
  // 6 rows of 1, halving the vertical footprint while keeping each row
  // easy to scan.
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
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
    <div className="flex items-baseline justify-between gap-2 min-w-0">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground truncate">
        {metric.label}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs font-semibold tabular-nums text-foreground">
          {metric.value}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold tabular-nums",
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
    ? "text-emerald-700 bg-emerald-50"
    : "text-rose-700 bg-rose-50";
}
