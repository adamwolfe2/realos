"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

type Point = {
  /** ISO date string, e.g. "2026-05-13" */
  weekOf: string;
  composite: number;
  technical: number;
  content: number;
  authority: number;
};

type Props = {
  data: Point[];
};

// ---------------------------------------------------------------------------
// Time-series line chart over SeoScoreHistory. Shows the weekly composite
// score plus the three sub-scores so operators can see *where* the lift
// is coming from. Defaults to a 12-week window.
// ---------------------------------------------------------------------------
export function ScoreHistoryChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <h3 className="text-sm font-semibold text-foreground">
          Score history
        </h3>
        <p className="text-[12px] text-muted-foreground mt-1">
          Once your first weekly snapshot lands (every Monday 05:00 UTC),
          this chart fills in.
        </p>
      </div>
    );
  }

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Score history
          </h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Weekly composite + sub-scores (Mon 05:00 UTC).
          </p>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          last {data.length}w
        </span>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
          >
            <CartesianGrid stroke="#E5E7EB" strokeDasharray="2 4" />
            <XAxis
              dataKey="weekOf"
              tickFormatter={fmt}
              tick={{ fontSize: 11, fill: "#6B7280" }}
              tickLine={false}
              axisLine={{ stroke: "#E5E7EB" }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#6B7280" }}
              tickLine={false}
              axisLine={{ stroke: "#E5E7EB" }}
            />
            <Tooltip
              labelFormatter={fmt}
              contentStyle={{
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
            <Line
              type="monotone"
              dataKey="composite"
              stroke="#2563EB"
              strokeWidth={2.5}
              dot={false}
              name="Composite"
            />
            <Line
              type="monotone"
              dataKey="technical"
              stroke="#10B981"
              strokeWidth={1.5}
              dot={false}
              name="Technical"
            />
            <Line
              type="monotone"
              dataKey="content"
              stroke="#F59E0B"
              strokeWidth={1.5}
              dot={false}
              name="Content"
            />
            <Line
              type="monotone"
              dataKey="authority"
              stroke="#8B5CF6"
              strokeWidth={1.5}
              dot={false}
              name="Authority"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
