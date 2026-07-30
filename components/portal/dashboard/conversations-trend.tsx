"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { ConversationTrendPoint } from "./conversations-trend-chart";

// Wrapper handles the empty state without recharts; the SVG chunk loads only
// when there's a real trend to plot (mirrors performance-over-time.tsx).
const ConversationsTrendChart = dynamic(() => import("./conversations-trend-chart"), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full border border-dashed border-border"
      aria-hidden="true"
    />
  ),
});

export function ConversationsTrend({
  points,
}: {
  points: ConversationTrendPoint[];
}) {
  if (points.every((p) => p.count === 0)) return null;
  return (
    <div className="h-[120px] mt-3">
      <ConversationsTrendChart points={points} />
    </div>
  );
}
