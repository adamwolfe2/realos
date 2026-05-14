import * as React from "react";

// ---------------------------------------------------------------------------
// SourceBars — visual ranking list. Per the premium-dashboard pass the
// flat "Source · count" lists scattered across the Reputation, Attribution,
// and Briefing surfaces all read as raw data with no information design.
// Each row now gets a horizontal bar proportional to the largest value in
// the set so the eye picks up rank, share, and outliers in one pass.
//
// Renders zero client JS — pure server-side SVG/CSS so the surfaces stay
// streaming-friendly. Used wherever we previously had:
//   <ul>
//     <li>Reddit · 10</li>
//     <li>Google · 10</li>
//     <li>Yelp · 2</li>
//   </ul>
// ---------------------------------------------------------------------------

export type SourceBarRow = {
  /** Unique key for the row (defaults to label). */
  id?: string;
  label: string;
  value: number;
  /** Optional leading visual (logo, icon). 14-16px square. */
  leading?: React.ReactNode;
  /** Optional href — wraps the whole row in a Link-style anchor. */
  href?: string;
};

type Props = {
  rows: SourceBarRow[];
  /** Hide the trailing percentage in case `value` is already a percent. */
  hidePercent?: boolean;
  /** Override the "100%" reference so bars are relative to a custom total. */
  total?: number;
  /** Empty-state message. */
  emptyMessage?: string;
  /** Cap the visible rows; remainder rolls up into "Other". */
  limit?: number;
};

export function SourceBars({
  rows,
  hidePercent = false,
  total,
  emptyMessage = "No data yet.",
  limit,
}: Props) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>;
  }

  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const reference =
    total ?? Math.max(...sorted.map((r) => r.value), 1);

  // Apply limit + rollup. Tiny tail buckets get collapsed into "Other"
  // so the user sees the top N + an aggregated remainder rather than a
  // long flat list with diminishing slivers.
  let visible: SourceBarRow[] = sorted;
  if (limit && sorted.length > limit) {
    const kept = sorted.slice(0, limit);
    const rest = sorted.slice(limit);
    const otherTotal = rest.reduce((s, r) => s + r.value, 0);
    visible = otherTotal > 0
      ? [...kept, { label: "Other", value: otherTotal }]
      : kept;
  }

  return (
    <ul className="space-y-2.5">
      {visible.map((row) => {
        const pct = reference > 0 ? (row.value / reference) * 100 : 0;
        const Content = (
          <>
            <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
              <span className="flex items-center gap-1.5 min-w-0">
                {row.leading ? (
                  <span className="shrink-0 inline-flex items-center justify-center h-4 w-4">
                    {row.leading}
                  </span>
                ) : null}
                <span className="text-xs font-medium text-foreground truncate">
                  {row.label}
                </span>
              </span>
              <span className="shrink-0 text-xs tabular-nums">
                <span className="font-semibold text-foreground">
                  {row.value.toLocaleString()}
                </span>
                {!hidePercent ? (
                  <span className="ml-1.5 text-muted-foreground">
                    {Math.round(pct)}%
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
              />
            </div>
          </>
        );

        return (
          <li key={row.id ?? row.label} className="min-w-0">
            {row.href ? (
              <a
                href={row.href}
                className="block rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/40 transition-colors"
              >
                {Content}
              </a>
            ) : (
              Content
            )}
          </li>
        );
      })}
    </ul>
  );
}
