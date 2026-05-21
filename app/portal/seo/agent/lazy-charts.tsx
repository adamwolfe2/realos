"use client";

// ---------------------------------------------------------------------------
// Client wrapper for the three heavy below-the-fold charts on /portal/seo/agent.
//
// Next.js 16 disallows `next/dynamic` with `ssr: false` inside Server
// Components. Hosting the dynamic imports here keeps the original
// bundle-splitting + skeleton loader behaviour (lazy parse, no SSR work)
// while satisfying the build's new constraint. The server page imports
// these wrappers directly and they swap in their real chunks client-side.
//
// Pass-through prop types match the underlying chart components 1:1 so
// the server page never has to know they're dynamically loaded.
// ---------------------------------------------------------------------------

import nextDynamic from "next/dynamic";
import type {
  ContentRoiNode,
} from "@/components/portal/seo/charts/content-roi-treemap";
import type {
  OpportunityPoint,
} from "@/components/portal/seo/charts/opportunity-matrix";

function ChartPlaceholder({ height }: { height: string }) {
  return (
    <div
      className={`w-full ${height} rounded-xl border border-dashed border-border bg-card animate-pulse`}
    />
  );
}

const ContentRoiTreemapInner = nextDynamic(
  () =>
    import("@/components/portal/seo/charts/content-roi-treemap").then(
      (m) => m.ContentRoiTreemap,
    ),
  { ssr: false, loading: () => <ChartPlaceholder height="h-[320px]" /> },
);

const OpportunityMatrixInner = nextDynamic(
  () =>
    import("@/components/portal/seo/charts/opportunity-matrix").then(
      (m) => m.OpportunityMatrix,
    ),
  { ssr: false, loading: () => <ChartPlaceholder height="h-[320px]" /> },
);

const SearchPathSankeyInner = nextDynamic(
  () =>
    import("@/components/portal/seo/charts/search-path-sankey").then(
      (m) => m.SearchPathSankey,
    ),
  { ssr: false, loading: () => <ChartPlaceholder height="h-[360px]" /> },
);

// Re-export with the same names + signatures the server page already uses.
// Prop types mirror the underlying components so consumers don't notice
// the lazy boundary.

export function ContentRoiTreemap(props: { nodes: ContentRoiNode[] }) {
  return <ContentRoiTreemapInner {...props} />;
}

export function OpportunityMatrix(props: { points: OpportunityPoint[] }) {
  return <OpportunityMatrixInner {...props} />;
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

export function SearchPathSankey(props: {
  nodes: SankeyNode[];
  links: SankeyLink[];
}) {
  return <SearchPathSankeyInner {...props} />;
}
