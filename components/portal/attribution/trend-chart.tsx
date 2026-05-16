import * as React from "react";

// ---------------------------------------------------------------------------
// TrendChart — multi-series line chart for the attribution page. Pure SVG
// so it streams from the server, no chart lib bundle, no client component.
//
// Each series is a colored polyline; the legend shows the series labels;
// the x-axis shows date markers (every Nth day depending on density);
// the y-axis is implicit (max value annotation top-right). Designed to
// match Clarity's flat line-chart aesthetic.
// ---------------------------------------------------------------------------

export type TrendSeries = {
  label: string;
  values: number[]; // Same length as `dates`
};

type Props = {
  title: string;
  description?: string;
  dates: string[]; // YYYY-MM-DD per point
  series: TrendSeries[];
  /** Total entries across all series — used for empty detection. */
  totalEntries?: number;
  emptyMessage?: string;
};

// Monochrome blue series — each line steps down in saturation so multi-
// series charts stay legible without resorting to a rainbow.
const SERIES_COLORS = [
  "#1D4ED8",
  "#2563EB",
  "#3B82F6",
  "#60A5FA",
  "#93C5FD",
  "#9CA3AF",
  "#D1D5DB",
];

export function TrendChart({
  title,
  description,
  dates,
  series,
  totalEntries,
  emptyMessage = "No data in the selected window.",
}: Props) {
  const computedTotal =
    totalEntries ??
    series.reduce((sum, s) => sum + s.values.reduce((a, b) => a + b, 0), 0);

  if (computedTotal === 0 || dates.length === 0) {
    return (
      <Card title={title} description={description}>
        <div className="h-32 flex items-center justify-center text-xs text-muted-foreground text-center px-6">
          {emptyMessage}
        </div>
      </Card>
    );
  }

  const max = Math.max(
    1,
    ...series.flatMap((s) => s.values),
  );

  // SVG viewport. Coords are normalized so the chart scales fluidly via
  // CSS width:100% — Clarity's screenshots showed responsive lines that
  // stretch full width.
  const W = 800;
  const H = 200;
  const PAD_LEFT = 28;
  const PAD_RIGHT = 12;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 28;
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const stepX = dates.length > 1 ? innerW / (dates.length - 1) : 0;

  function pointFor(seriesIdx: number, valueIdx: number, value: number) {
    const x = PAD_LEFT + valueIdx * stepX;
    const y = PAD_TOP + innerH - (value / max) * innerH;
    void seriesIdx;
    return { x, y };
  }

  // Decide x-axis label cadence so 30+ days don't crash into each other.
  const labelEvery = dates.length > 14 ? Math.ceil(dates.length / 8) : 1;

  return (
    <Card title={title} description={description}>
      <div className="overflow-x-auto -mx-1 px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          preserveAspectRatio="none"
          role="img"
          aria-label={title}
          className="h-36 min-w-[300px]"
        >
          {/* Horizontal gridlines at 25/50/75/100% of max */}
          {[0.25, 0.5, 0.75, 1].map((p) => {
            const y = PAD_TOP + innerH - p * innerH;
            return (
              <line
                key={p}
                x1={PAD_LEFT}
                x2={W - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="#E5E7EB"
                strokeWidth={1}
                strokeDasharray="2 4"
              />
            );
          })}
          {/* Y-axis max marker */}
          <text
            x={PAD_LEFT - 4}
            y={PAD_TOP + 4}
            textAnchor="end"
            fontSize={9}
            fill="#6B7280"
          >
            {max.toLocaleString()}
          </text>
          {/* X-axis date labels */}
          {dates.map((date, i) => {
            if (i % labelEvery !== 0 && i !== dates.length - 1) return null;
            const x = PAD_LEFT + i * stepX;
            return (
              <text
                key={date}
                x={x}
                y={H - 8}
                textAnchor="middle"
                fontSize={9}
                fill="#6B7280"
              >
                {formatTickLabel(date)}
              </text>
            );
          })}
          {/* Series lines */}
          {series.map((s, sIdx) => {
            const color = SERIES_COLORS[sIdx % SERIES_COLORS.length];
            const points = s.values
              .map((v, i) => {
                const { x, y } = pointFor(sIdx, i, v);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(" ");
            return (
              <polyline
                key={s.label}
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      {series.length > 0 ? (
        <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          {series.map((s, i) => (
            <li
              key={s.label}
              className="flex items-center gap-1.5 text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
                }}
              />
              <span className="text-foreground font-medium">{s.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function formatTickLabel(yyyyMmDd: string): string {
  // "2026-04-12" → "Apr 12". Cheaper than date-fns for one-shot rendering.
  const parts = yyyyMmDd.split("-");
  if (parts.length !== 3) return yyyyMmDd;
  const monthIdx = Number.parseInt(parts[1], 10) - 1;
  const day = Number.parseInt(parts[2], 10);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  if (monthIdx < 0 || monthIdx > 11 || Number.isNaN(day)) return yyyyMmDd;
  return `${months[monthIdx]} ${day}`;
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
    <section className="rounded-xl border border-border bg-card p-3">
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
