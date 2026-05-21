"use client";

import { ResponsiveContainer, Treemap } from "recharts";
import { BRAND, SectionHeader } from "./shared";

// ---------------------------------------------------------------------------
// Per-URL performance treemap. Cell size = clicks, saturation = composite
// ROI score (0–100). Extracted from seo-phase2-charts.tsx so the Treemap
// import lives in its own bundle chunk (lazy-loaded from /portal/seo/agent).
// ---------------------------------------------------------------------------

export type ContentRoiNode = {
  url: string;
  clicks: number;
  rankCount: number;
  conversions: number;
  roiScore: number;
};

type TreemapCellProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  roiScore?: number;
};

function RoiTreemapCell(props: TreemapCellProps = {}) {
  const { x = 0, y = 0, width = 0, height = 0, name, roiScore = 0 } = props;
  if (!width || !height) return null;
  const opacity = 0.25 + (roiScore / 100) * 0.7;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={BRAND}
        fillOpacity={opacity}
      />
      {width > 60 && height > 24 ? (
        <text
          x={x + 6}
          y={y + 14}
          fontSize={10}
          fill="#fff"
          fontFamily="var(--font-mono)"
        >
          {(name ?? "").slice(0, Math.max(8, width / 7))}
        </text>
      ) : null}
    </g>
  );
}

export function ContentRoiTreemap({ nodes }: { nodes: ContentRoiNode[] }) {
  if (nodes.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <SectionHeader eyebrow="Content ROI" title="Per-URL performance" />
        <p className="text-[12px] text-muted-foreground py-8 text-center">
          Pages appear here once you have ranking + click data.
        </p>
      </section>
    );
  }
  const data = nodes.map((n) => ({
    name: n.url.replace(/^https?:\/\//, "").slice(0, 48),
    size: Math.max(1, n.clicks),
    roiScore: n.roiScore,
    clicks: n.clicks,
    rankCount: n.rankCount,
  }));
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        eyebrow="Content ROI"
        title="Per-URL performance"
        hint="Cell size = clicks · saturation = composite ROI score (0–100)"
      />
      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            stroke="#fff"
            content={<RoiTreemapCell />}
          />
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default ContentRoiTreemap;
