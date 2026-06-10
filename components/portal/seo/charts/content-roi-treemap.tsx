"use client";

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

// Per-URL performance — a ranked bar list (replaced the recharts Treemap,
// which collapsed to one giant blue cell for properties with a single page).
// Sorted by clicks; the bar shows composite ROI (0–100). Legible at 1 URL or 50.
export function ContentRoiTreemap({ nodes }: { nodes: ContentRoiNode[] }) {
  if (nodes.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          eyebrow="Content ROI"
          title="Per-URL performance"
          hint="Clicks + composite ROI score (clicks × keyword count × conversions)."
        />
        <EmptyStateBody
          preview={<ContentRoiPreview />}
          body="Every URL is ranked by clicks with an ROI bar — clicks × keyword count × conversions. One glance tells you which pages are pulling weight and which need a refresh."
          example={`/listings reads as a workhorse; a high-traffic /guides/section-8-housing with a short ROI bar flags a page with low conversions, prime for a CTA rewrite.`}
        />
      </section>
    );
  }

  const rows = [...nodes].sort((a, b) => b.clicks - a.clicks).slice(0, 12);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        eyebrow="Content ROI"
        title="Per-URL performance"
        hint="Ranked by clicks · bar = composite ROI score (0–100)"
      />
      <ul className="mt-3 space-y-1.5">
        {rows.map((n) => {
          const clean =
            n.url.replace(/^https?:\/\//, "").replace(/\/$/, "") || "/";
          const roiPct = Math.max(2, Math.min(100, Math.round(n.roiScore)));
          return (
            <li
              key={n.url}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 items-center py-2 border-b border-[var(--hair)] last:border-0"
            >
              <div className="min-w-0">
                <div
                  className="text-[12.5px] text-foreground truncate font-mono"
                  title={n.url}
                >
                  {clean}
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${roiPct}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px] tabular-nums text-muted-foreground shrink-0">
                <span>
                  <span className="text-foreground font-semibold">
                    {n.clicks.toLocaleString()}
                  </span>{" "}
                  clicks
                </span>
                <span>{n.rankCount} kw</span>
                <span>{n.conversions} conv</span>
                <span className="text-foreground font-semibold">
                  {Math.round(n.roiScore)} ROI
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default ContentRoiTreemap;
