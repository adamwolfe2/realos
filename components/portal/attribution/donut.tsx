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

// Brand-aligned palettes. Each chart on /portal/attribution picks a
// different lead color so single-slice donuts read as distinct visuals
// rather than identical black rings. Multi-slice donuts cycle through
// supporting colors after the lead.
const PALETTES: Record<NonNullable<Props["palette"]>, string[]> = {
  ink: ["#1A1A1A", "#2563EB", "#10B981", "#F59E0B", "#B53333", "#8B5CF6", "#0EA5E9", "#87867F"],
  blue: ["#2563EB", "#1A1A1A", "#10B981", "#F59E0B", "#B53333", "#8B5CF6", "#0EA5E9", "#87867F"],
  emerald: ["#10B981", "#2563EB", "#1A1A1A", "#F59E0B", "#B53333", "#8B5CF6", "#0EA5E9", "#87867F"],
  amber: ["#F59E0B", "#2563EB", "#10B981", "#1A1A1A", "#B53333", "#8B5CF6", "#0EA5E9", "#87867F"],
  violet: ["#8B5CF6", "#2563EB", "#10B981", "#F59E0B", "#1A1A1A", "#B53333", "#0EA5E9", "#87867F"],
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
