"use client";

import { ResponsiveContainer, Treemap } from "recharts";
import { BRAND, BRAND_LIGHT, BRAND_LIGHTER, SectionHeader, EmptyStateBody } from "./shared";

// Faded preview treemap — six cells in varying saturations so the
// operator sees "this is going to be a heatmap of pages."
function ContentRoiPreview() {
  const cells = [
    { x: 0, y: 0, w: 60, h: 50, fill: BRAND, opacity: 0.78, label: "/listings" },
    { x: 60, y: 0, w: 40, h: 30, fill: BRAND, opacity: 0.55, label: "/landlords" },
    { x: 100, y: 0, w: 40, h: 30, fill: BRAND_LIGHT, opacity: 0.7, label: "/cities" },
    { x: 60, y: 30, w: 80, h: 20, fill: BRAND_LIGHT, opacity: 0.45, label: "/guides" },
    { x: 0, y: 50, w: 80, h: 26, fill: BRAND_LIGHTER, opacity: 0.85, label: "/about" },
    { x: 80, y: 50, w: 60, h: 26, fill: BRAND_LIGHTER, opacity: 0.55, label: "/contact" },
  ];
  return (
    <svg viewBox="0 0 140 76" className="w-full h-auto" role="img" aria-hidden="true">
      {cells.map((c, i) => (
        <g key={i}>
          <rect
            x={c.x + 1}
            y={c.y + 1}
            width={c.w - 2}
            height={c.h - 2}
            fill={c.fill}
            fillOpacity={c.opacity}
            rx={1.5}
          />
          {c.w >= 36 && c.h >= 16 ? (
            <text
              x={c.x + 4}
              y={c.y + 10}
              fontSize="5.5"
              fontFamily="var(--font-mono)"
              fill="#fff"
              fillOpacity="0.95"
            >
              {c.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

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
        <SectionHeader
          eyebrow="Content ROI"
          title="Per-URL performance"
          hint="Cell size = clicks · color saturation = composite ROI score (0–100)."
        />
        <EmptyStateBody
          preview={<ContentRoiPreview />}
          body="Each URL gets its own cell — larger cells mean more clicks, deeper blue means a higher ROI score (clicks × keyword count × conversions). One glance tells you which pages are pulling weight and which need a refresh."
          example={`A bright, oversized cell on /listings means it's a workhorse — a small, pale cell on /guides/section-8-housing flags a high-traffic page with low conversions, prime for a CTA rewrite.`}
        />
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
