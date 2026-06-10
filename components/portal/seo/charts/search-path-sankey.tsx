"use client";

import { BRAND, BRAND_LIGHT, BRAND_LIGHTER, BORDER, MUTED, SectionHeader, EmptyStateBody } from "./shared";

// Faded preview Sankey — three columns with ribbons of varying thickness
// so the operator sees the flow concept without real data.
function SearchPathPreview() {
  return (
    <svg viewBox="0 0 160 96" className="w-full h-auto" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="sp-ribbon-a" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={BRAND} stopOpacity={0.55} />
          <stop offset="100%" stopColor={BRAND_LIGHT} stopOpacity={0.4} />
        </linearGradient>
        <linearGradient id="sp-ribbon-b" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={BRAND_LIGHT} stopOpacity={0.5} />
          <stop offset="100%" stopColor={BRAND_LIGHTER} stopOpacity={0.6} />
        </linearGradient>
      </defs>
      {/* Ribbons */}
      <path
        d="M 18 12 C 60 12, 60 26, 78 26 L 78 40 C 60 40, 60 26, 18 26 Z"
        fill="url(#sp-ribbon-a)"
      />
      <path
        d="M 18 32 C 60 32, 60 48, 78 48 L 78 60 C 60 60, 60 48, 18 48 Z"
        fill="url(#sp-ribbon-a)"
        fillOpacity="0.8"
      />
      <path
        d="M 18 54 C 60 54, 60 76, 78 76 L 78 84 C 60 84, 60 76, 18 76 Z"
        fill="url(#sp-ribbon-a)"
        fillOpacity="0.55"
      />
      <path
        d="M 86 26 C 118 26, 118 18, 142 18 L 142 30 C 118 30, 118 40, 86 40 Z"
        fill="url(#sp-ribbon-b)"
      />
      <path
        d="M 86 48 C 118 48, 118 52, 142 52 L 142 70 C 118 70, 118 60, 86 60 Z"
        fill="url(#sp-ribbon-b)"
        fillOpacity="0.85"
      />
      {/* Nodes */}
      {[12, 32, 54].map((y, i) => (
        <rect key={`l-${i}`} x="14" y={y} width="4" height="14" rx="1" fill={BRAND} />
      ))}
      {[26, 48].map((y, i) => (
        <rect key={`m-${i}`} x="78" y={y} width="4" height="20" rx="1" fill={BRAND} />
      ))}
      {[18, 52].map((y, i) => (
        <rect key={`r-${i}`} x="142" y={y} width="4" height={i === 0 ? 12 : 18} rx="1" fill={BRAND} />
      ))}
      {/* Column captions */}
      <text x="14" y="6" fontSize="5" fontFamily="var(--font-mono)" fill={MUTED}>
        QUERIES
      </text>
      <text x="74" y="6" fontSize="5" fontFamily="var(--font-mono)" fill={MUTED} textAnchor="start">
        PAGES
      </text>
      <text x="146" y="6" fontSize="5" fontFamily="var(--font-mono)" fill={MUTED} textAnchor="end">
        OUTCOMES
      </text>
      <line x1="10" y1="92" x2="150" y2="92" stroke={BORDER} strokeDasharray="2 2" />
    </svg>
  );
}

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
// Search path — three columns: top queries → top landing pages → outcomes
// (engaged / converted). Previously a custom SVG Sankey, which collapsed to a
// single full-height blue bar per column for properties with one query / one
// page. This bar-list version conveys the same data and is always legible,
// whether there's 1 query or 20.
// ---------------------------------------------------------------------------

const COLUMN_TITLES = ["Top queries", "Landing pages", "Outcomes"] as const;

export function SearchPathSankey({ nodes, links }: Props) {
  if (nodes.length === 0 || links.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          eyebrow="Pipeline"
          title="Search path"
          hint="Top queries → landing pages → engagement/conversion outcomes."
        />
        <EmptyStateBody
          preview={<SearchPathPreview />}
          body="Joins Search Console clicks with GA4 session outcomes — which queries drive clicks, which pages they land on, and how many engage or convert."
          example={`If 312 clicks for "section 8 housing nyc" land on /listings and 41 convert, you'll see /listings near the top of Landing pages and a strong "converted" bar under Outcomes.`}
        />
      </section>
    );
  }

  const layers: SankeyNode[][] = [[], [], []];
  for (const n of nodes) layers[n.layer]?.push(n);
  const layerMax = layers.map((arr) =>
    Math.max(1, ...arr.map((n) => n.value)),
  );

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        eyebrow="Pipeline"
        title="Search path"
        hint="Top queries → landing pages → engagement/conversion outcomes (last 30d)."
      />
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
        {layers.map((arr, li) => (
          <div key={li}>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground mb-2">
              {COLUMN_TITLES[li]}
            </div>
            {arr.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">No data yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {[...arr]
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 6)
                  .map((n) => (
                    <li key={n.id}>
                      <div className="flex items-center justify-between gap-2 text-[12px]">
                        <span
                          className="truncate text-foreground"
                          title={n.label}
                        >
                          {n.label}
                        </span>
                        <span className="tabular-nums text-muted-foreground shrink-0">
                          {n.value.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.max(3, Math.round((n.value / layerMax[li]) * 100))}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default SearchPathSankey;
