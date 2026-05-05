import * as React from "react";

// ---------------------------------------------------------------------------
// SourceDonut — minimalist SVG donut chart for the attribution page. No
// charting lib, no client component — pure server-rendered SVG so the
// /portal/attribution page can stream and the surface stays cheap.
//
// Renders:
//   - The donut itself (slices proportional to count)
//   - A center label (total)
//   - A side legend with percentage + raw count per slice
//
// Designed to read like Clarity's donut style: clean white background,
// flat colors, large center percentage on the dominant slice, tabular
// counts on the right.
// ---------------------------------------------------------------------------

export type DonutSlice = {
  label: string;
  value: number;
};

type Props = {
  slices: DonutSlice[];
  /** Heading shown above the chart. */
  title: string;
  /** Optional one-line description below the title. */
  description?: string;
  /** Total label override; defaults to sum of slice values. */
  totalLabel?: string;
  /** Empty-state message when slices.length === 0. */
  emptyMessage?: string;
  /** Picks the chart's color theme. Each surface on /portal/attribution
   *  passes a different value so single-slice donuts don't all look
   *  identical (every chart was rendering as 100% black before). */
  palette?: "ink" | "blue" | "emerald" | "amber" | "violet";
};

// Monochrome blue palettes. Every donut now reads as a unified blue
// visualization — the lead slice gets the deepest tone, supporting slices
// step down through brand blue into pale, with neutral gray as the
// "other" bucket. The five named palette options exist only to vary the
// lead color across stacked donuts so single-slice rings don't all look
// identical, but every variant stays inside a blue + gray scale.
const PALETTES: Record<NonNullable<Props["palette"]>, string[]> = {
  ink:     ["#0F172A", "#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#9CA3AF", "#D1D5DB", "#E5E7EB"],
  blue:    ["#1D4ED8", "#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#9CA3AF", "#D1D5DB", "#E5E7EB"],
  emerald: ["#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#9CA3AF", "#D1D5DB", "#E5E7EB", "#F3F4F6"],
  amber:   ["#3B82F6", "#2563EB", "#1D4ED8", "#60A5FA", "#93C5FD", "#9CA3AF", "#D1D5DB", "#E5E7EB"],
  violet:  ["#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8", "#93C5FD", "#9CA3AF", "#D1D5DB", "#E5E7EB"],
};

export function SourceDonut({
  slices,
  title,
  description,
  totalLabel,
  emptyMessage = "No data in the selected window.",
  palette = "ink",
}: Props) {
  const COLORS = PALETTES[palette];
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (total === 0 || slices.length === 0) {
    return (
      <Card title={title} description={description}>
        <div className="h-32 flex items-center justify-center text-xs text-muted-foreground text-center px-6">
          {emptyMessage}
        </div>
      </Card>
    );
  }

  const sorted = [...slices].sort((a, b) => b.value - a.value);
  const dominant = sorted[0];
  const dominantPct = Math.round((dominant.value / total) * 100);

  // Build SVG arc segments. radius/innerRadius keep the donut weight
  // close to Clarity's reference (chunky enough that small slices still
  // read at a glance).
  const size = 132;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const arcs = sorted.map((slice, i) => {
    const fraction = slice.value / total;
    const offset = -cumulative * circumference;
    const dasharray = `${fraction * circumference} ${circumference}`;
    cumulative += fraction;
    return {
      slice,
      color: COLORS[i % COLORS.length],
      dasharray,
      offset,
    };
  });

  return (
    <Card title={title} description={description}>
      <div className="grid grid-cols-[auto,1fr] gap-4 items-center">
        <div className="relative shrink-0">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={title}
            style={{ transform: "rotate(-90deg)" }}
          >
            {arcs.map((arc, i) => (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeDasharray={arc.dasharray}
                strokeDashoffset={arc.offset}
              />
            ))}
          </svg>
          <div
            className="absolute inset-0 flex items-center justify-center text-center"
            aria-hidden="true"
          >
            <div>
              <p className="text-lg font-semibold tabular-nums text-foreground leading-none">
                {dominantPct}%
              </p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1 px-2">
                {totalLabel ?? `${total.toLocaleString()} total`}
              </p>
            </div>
          </div>
        </div>
        <ul className="space-y-1 min-w-0">
          {sorted.map((slice, i) => {
            const pct = Math.round((slice.value / total) * 100);
            return (
              <li
                key={slice.label}
                className="flex items-center justify-between gap-3 text-xs min-w-0"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="truncate text-foreground">
                    {slice.label}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {pct}%
                  <span className="ml-2 text-foreground">
                    ({slice.value.toLocaleString()})
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2">
        <h3 className="text-xs font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
