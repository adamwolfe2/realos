import * as React from "react";

// ---------------------------------------------------------------------------
// Sentiment-over-time sparkline.
//
// Renders weekly buckets as small stacked bars: positive (primary) above
// neutral above negative (foreground). Purely server-rendered; takes a
// pre-aggregated payload so we don't ship the raw mention list to the
// client.
//
// Inputs:
//   weeks: 12 weekly buckets, oldest → newest. Each has positive / neutral
//   / negative / mixed counts. We collapse "mixed" into "neutral" for the
//   visual — the inbox already shows mixed explicitly and three colors is
//   the visual budget for a 12-bar sparkline.
// ---------------------------------------------------------------------------

export type SparkBucket = {
  weekStart: string; // ISO date (Monday)
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
};

export function SentimentSparkline({ weeks }: { weeks: SparkBucket[] }) {
  if (!weeks || weeks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No mentions in the last 12 weeks — run a scan to populate the trend.
      </p>
    );
  }

  const max = Math.max(
    1,
    ...weeks.map((w) => w.positive + w.neutral + w.negative + w.mixed),
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-1 h-16">
        {weeks.map((w) => {
          const total = w.positive + w.neutral + w.mixed + w.negative;
          const heightPct = total > 0 ? (total / max) * 100 : 0;
          const posPct = total > 0 ? (w.positive / total) * 100 : 0;
          // Collapse mixed into the neutral slot for the visual budget.
          const neuPct = total > 0 ? ((w.neutral + w.mixed) / total) * 100 : 0;
          const negPct = total > 0 ? (w.negative / total) * 100 : 0;
          return (
            <div
              key={w.weekStart}
              className="flex-1 flex flex-col items-center justify-end group"
              title={`Week of ${formatWeek(w.weekStart)} — ${w.positive} positive · ${w.neutral + w.mixed} neutral/mixed · ${w.negative} negative`}
            >
              <div
                className="w-full rounded-sm overflow-hidden flex flex-col"
                style={{ height: `${Math.max(heightPct, 4)}%` }}
              >
                {posPct > 0 ? (
                  <div
                    className="bg-primary"
                    style={{ height: `${posPct}%` }}
                  />
                ) : null}
                {neuPct > 0 ? (
                  <div
                    className="bg-muted-foreground/40"
                    style={{ height: `${neuPct}%` }}
                  />
                ) : null}
                {negPct > 0 ? (
                  <div
                    className="bg-foreground"
                    style={{ height: `${negPct}%` }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <LegendDot tone="bg-primary" label="Positive" />
        <LegendDot tone="bg-muted-foreground/40" label="Neutral / mixed" />
        <LegendDot tone="bg-foreground" label="Negative" />
        <span className="ml-auto tabular-nums">12-week trend</span>
      </div>
    </div>
  );
}

function LegendDot({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-2 w-2 rounded-full ${tone}`} />
      {label}
    </span>
  );
}

function formatWeek(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
