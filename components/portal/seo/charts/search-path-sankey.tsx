"use client";

import { BRAND, BRAND_LIGHT, BORDER, MUTED, SectionHeader } from "./shared";

type SankeyNode = {
  id: string;
  label: string;
  layer: 0 | 1 | 2;
  value: number;
};
type SankeyLink = {
  source: string;
  target: string;
  value: number;
};
type Props = {
  nodes: SankeyNode[];
  links: SankeyLink[];
};

// ---------------------------------------------------------------------------
// Lightweight Sankey diagram. Custom-built so we don't pull in
// d3-sankey or @nivo/sankey — saves ~80KB on the agent bundle. Three
// layers: top queries (left) → top landing URLs (middle) → outcome
// (engaged / converted, right). Bezier links with thickness ∝ value.
//
// Layout: compute y positions per layer by stacking node values inside
// a fixed-height column. Link path is a cubic bezier between source
// midpoint and target midpoint.
// ---------------------------------------------------------------------------
export function SearchPathSankey({ nodes, links }: Props) {
  if (nodes.length === 0 || links.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          eyebrow="Pipeline"
          title="Search path Sankey"
          hint="Appears once you have GSC clicks + GA4 sessions per landing URL."
        />
        <div className="h-24 flex items-center justify-center text-[12px] text-muted-foreground">
          Waiting on first joined day of data.
        </div>
      </section>
    );
  }

  const width = 720;
  const height = 360;
  const padLeft = 12;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 16;
  const layerWidth = (width - padLeft - padRight) / 3;
  const innerHeight = height - padTop - padBottom;
  const nodeWidth = 8;
  const gap = 6;

  // Group nodes by layer
  const layers: SankeyNode[][] = [[], [], []];
  for (const n of nodes) layers[n.layer].push(n);

  // Compute total per layer for proportional sizing
  const layerTotals = layers.map((arr) =>
    arr.reduce((acc, n) => acc + Math.max(1, n.value), 0),
  );

  // For each node, compute y0 (top) + y1 (bottom)
  type Placed = {
    node: SankeyNode;
    x: number;
    y0: number;
    y1: number;
  };
  const placed: Placed[] = [];
  for (let li = 0; li < 3; li += 1) {
    const arr = layers[li];
    if (arr.length === 0) continue;
    const totalGap = gap * (arr.length - 1);
    const total = layerTotals[li];
    const available = innerHeight - totalGap;
    let y = padTop;
    const x = padLeft + li * layerWidth + (li === 1 ? layerWidth / 2 - nodeWidth / 2 : li === 2 ? layerWidth - nodeWidth : 0);
    for (const n of arr) {
      const h = Math.max(8, (Math.max(1, n.value) / total) * available);
      placed.push({ node: n, x, y0: y, y1: y + h });
      y = y + h + gap;
    }
  }

  const idIndex = new Map(placed.map((p) => [p.node.id, p]));

  // For link path generation, we need per-node offsets when multiple links
  // touch a node (so they don't overlap).
  const outOffset = new Map<string, number>(); // source id -> running y offset
  const inOffset = new Map<string, number>(); // target id -> running y offset

  // Pre-sort links so larger ones render first (visual hierarchy).
  const sortedLinks = [...links].sort((a, b) => b.value - a.value);

  const linkPaths = sortedLinks
    .map((l) => {
      const s = idIndex.get(l.source);
      const t = idIndex.get(l.target);
      if (!s || !t) return null;
      const sHeight = s.y1 - s.y0;
      const tHeight = t.y1 - t.y0;
      const sTotal = Math.max(
        1,
        sortedLinks
          .filter((x) => x.source === l.source)
          .reduce((a, b) => a + b.value, 0),
      );
      const tTotal = Math.max(
        1,
        sortedLinks
          .filter((x) => x.target === l.target)
          .reduce((a, b) => a + b.value, 0),
      );
      const sLinkH = (l.value / sTotal) * sHeight;
      const tLinkH = (l.value / tTotal) * tHeight;
      const sCursor = outOffset.get(l.source) ?? 0;
      const tCursor = inOffset.get(l.target) ?? 0;
      const sy = s.y0 + sCursor;
      const ty = t.y0 + tCursor;
      outOffset.set(l.source, sCursor + sLinkH);
      inOffset.set(l.target, tCursor + tLinkH);

      const x0 = s.x + nodeWidth;
      const x1 = t.x;
      const cp = (x0 + x1) / 2;
      const yMidTop = sy + sLinkH / 2;
      const yMidBot = ty + tLinkH / 2;
      // Two cubic beziers describe the upper + lower edges of the ribbon.
      const d = [
        `M ${x0} ${sy}`,
        `C ${cp} ${sy}, ${cp} ${ty}, ${x1} ${ty}`,
        `L ${x1} ${ty + tLinkH}`,
        `C ${cp} ${ty + tLinkH}, ${cp} ${sy + sLinkH}, ${x0} ${sy + sLinkH}`,
        "Z",
      ].join(" ");
      void yMidTop;
      void yMidBot;
      return { d, value: l.value };
    })
    .filter(Boolean) as { d: string; value: number }[];

  const layerLabels = ["Top queries", "Landing URLs", "Outcomes"];

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        eyebrow="Pipeline"
        title="Search path"
        hint="Top-5 queries flowing into landing pages, then engagement + conversion."
      />
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ minWidth: 540 }}
          role="img"
          aria-label="Sankey diagram of search query to landing URL to outcome"
        >
          {/* Layer labels */}
          {layerLabels.map((lbl, i) => (
            <text
              key={lbl}
              x={padLeft + i * layerWidth + (i === 1 ? layerWidth / 2 : i === 2 ? layerWidth : 0)}
              y={10}
              fill={MUTED}
              fontSize={9}
              fontFamily="var(--font-mono)"
              textAnchor={i === 0 ? "start" : i === 1 ? "middle" : "end"}
            >
              {lbl.toUpperCase()}
            </text>
          ))}

          {/* Link ribbons */}
          {linkPaths.map((l, i) => (
            <path
              key={i}
              d={l.d}
              fill={BRAND_LIGHT}
              fillOpacity={0.45}
              stroke={BRAND}
              strokeOpacity={0.15}
              strokeWidth={0.5}
            />
          ))}

          {/* Nodes */}
          {placed.map((p) => (
            <g key={p.node.id}>
              <rect
                x={p.x}
                y={p.y0}
                width={nodeWidth}
                height={p.y1 - p.y0}
                fill={BRAND}
                rx={2}
              />
              <text
                x={
                  p.node.layer === 0
                    ? p.x + nodeWidth + 4
                    : p.node.layer === 2
                      ? p.x - 4
                      : p.x + nodeWidth + 4
                }
                y={(p.y0 + p.y1) / 2 + 3}
                fill="#1E2A3A"
                fontSize={10}
                fontFamily="var(--font-mono)"
                textAnchor={p.node.layer === 2 ? "end" : "start"}
              >
                {p.node.label}
              </text>
            </g>
          ))}

          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="none"
            stroke={BORDER}
            strokeWidth={0.5}
          />
        </svg>
      </div>
    </section>
  );
}

export default SearchPathSankey;
