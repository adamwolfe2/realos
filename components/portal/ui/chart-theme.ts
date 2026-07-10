// ---------------------------------------------------------------------------
// chart-theme.ts — single source of truth for Recharts visual styling.
// All recharts-backed charts (ads, seo, attribution, reputation, performance
// over time) import these tokens so the visualizations read as one coherent
// language instead of five different chart libraries.
// ---------------------------------------------------------------------------

export const CHART_COLORS = {
  brand: "#0f62fe",       // primary series — Carbon Blue 60
  brandDeep: "#002d9c",   // 2nd primary — Blue 80
  brandSoft: "#4589ff",   // 3rd — Blue 50
  brandFog:  "#a6c8ff",   // 4th / background — Blue 30
  success: "#24a148",
  warning: "#f1c21b",
  danger:  "#da1e28",
  ink:     "#161616",
  body:    "#393939",
  muted:   "#6f6f6f",
  silver:  "#8d8d8d",
  grid:    "#e0e0e0",     // hard Carbon grid lines
  axis:    "#8d8d8d",     // axis tick label color
};

export const CHART_AXIS_TICK = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  fill: CHART_COLORS.muted,
  fontVariantNumeric: "tabular-nums" as const,
};

export const CHART_GRID_PROPS = {
  strokeDasharray: "3 3",
  stroke: CHART_COLORS.grid,
  vertical: false as const,
};

export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.98)",
  border: "1px solid #e0e0e0",
  borderRadius: 2,
  padding: "8px 12px",
  boxShadow: "0 4px 12px rgba(22,22,22,0.08), 0 1px 2px rgba(22,22,22,0.04)",
  fontSize: 12,
  color: CHART_COLORS.body,
  fontFamily: "var(--font-sans)",
};

export const CHART_TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: CHART_COLORS.muted,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: 4,
};

export const CHART_TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: CHART_COLORS.body,
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
};

export const CHART_LEGEND_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "var(--font-sans)",
  color: CHART_COLORS.muted,
  paddingTop: 8,
};

// Standard area-fill gradients. Drop the matching <linearGradient> into each
// chart's <defs>. Reusing IDs across files is fine since SVG defs are scoped
// to the chart's own SVG root.
export const CHART_GRADIENTS = `
  <linearGradient id="lsBrandFill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="${CHART_COLORS.brand}" stopOpacity="0.22" />
    <stop offset="100%" stopColor="${CHART_COLORS.brand}" stopOpacity="0" />
  </linearGradient>
`;
