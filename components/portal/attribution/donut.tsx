import * as React from "react";

// ---------------------------------------------------------------------------
// SourceDonut — minimalist SVG donut chart for the attribution page.
//
// Premium-pass rewrite: the previous version stacked a small 132px donut
// next to a small label list, so a single 100%-blue ring at 75% sat in
// the page reading as filler. New version:
//   - Larger donut (160px), thicker stroke, gradient track
//   - Dominant percentage uses the hero (text-4xl) treatment
//   - Legend rows render with inline proportional bars so even a
//     binary 75/25 split feels like a visualization, not a list
//   - Soft inner highlight so the ring reads as 3D-lite without being
//     skeuomorphic
// ---------------------------------------------------------------------------

export type DonutSlice = {
  label: string;
  value: number;
};

type Props = {
  slices: DonutSlice[];
  title: string;
  description?: string;
  totalLabel?: string;
  emptyMessage?: string;
  /** Picks the chart's color theme. */
  palette?: "ink" | "blue" | "emerald" | "amber" | "violet";
};

// Monochrome blue palettes. Variants are named for backwards-compat with
// existing call sites; every palette stays inside a blue + gray scale so
// the page reads as one coherent visualization, not a rainbow.
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

  // Bigger donut so it reads as the hero. Was 132px / strokeWidth 22 —
  // now 160 / 26 so the chart anchors the card visually instead of
  // sitting timid next to a label list.
  const size = 160;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Slight gap between slices for premium ringed look.
  let cumulative = 0;
  const arcs = sorted.map((slice, i) => {
    const fraction = slice.value / total;
    const offset = -cumulative * circumference;
    const dasharray = `${Math.max(0, fraction * circumference - 1.5)} ${circumference}`;
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
      <div className="grid grid-cols-[auto,1fr] gap-5 items-center">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          {/* Background track ring — keeps the visual outline even when the
              dominant slice doesn't dominate. */}
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="absolute inset-0"
            aria-hidden="true"
          >
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#F3F4F6"
              strokeWidth={strokeWidth}
            />
          </svg>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={title}
            style={{ transform: "rotate(-90deg)" }}
            className="relative"
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
                strokeLinecap="butt"
              />
            ))}
          </svg>
          <div
            className="absolute inset-0 flex items-center justify-center text-center"
            aria-hidden="true"
          >
            <div>
              {/* Premium hierarchy: oversized percentage anchors the card.
                  Was text-lg (18px); now text-4xl (~36px) so the donut
                  carries actual visual weight even at single-slice 100%. */}
              <p className="text-4xl font-semibold tabular-nums text-foreground leading-none tracking-tight">
                {dominantPct}
                <span className="text-lg text-muted-foreground ml-0.5">%</span>
              </p>
              <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground mt-2 px-2 font-semibold">
                {totalLabel ?? `${total.toLocaleString()} total`}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 px-2 truncate max-w-[110px]">
                {dominant.label}
              </p>
            </div>
          </div>
        </div>
        {/* Legend with inline proportional bars so each row is its own
            mini-viz. Far more informative than the previous text-only
            "pct · count" pair, especially on binary splits. */}
        <ul className="space-y-2 min-w-0">
          {sorted.map((slice, i) => {
            const pct = Math.round((slice.value / total) * 100);
            const color = COLORS[i % COLORS.length];
            return (
              <li key={slice.label} className="min-w-0">
                <div className="flex items-center justify-between gap-3 text-xs mb-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate text-foreground font-medium">
                      {slice.label}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold text-foreground">{pct}%</span>
                    <span className="ml-2 text-muted-foreground">
                      ({slice.value.toLocaleString()})
                    </span>
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(2, pct)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
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
    <section className="rounded-xl border border-border bg-card p-4 transition-all hover:shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
