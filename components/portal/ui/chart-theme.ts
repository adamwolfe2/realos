// ---------------------------------------------------------------------------
// chart-theme.ts — single source of truth for Recharts visual styling.
// All recharts-backed charts (ads, seo, attribution, reputation, performance
// over time) import these tokens so the visualizations read as one coherent
// language instead of five different chart libraries.
// ---------------------------------------------------------------------------

export const CHART_COLORS = {
  brand: "#2563EB",       // primary series
  brandDeep: "#1D4ED8",   // 2nd primary
  brandSoft: "#3B82F6",   // 3rd
  brandFog:  "#93C5FD",   // 4th / background
  success: "#16A34A",
  warning: "#F59E0B",
  danger:  "#DC2626",
  ink:     "#0F172A",
  body:    "#1F2937",
  muted:   "#6B7280",
  silver:  "#9CA3AF",
  grid:    "#EEF0F3",     // very soft horizontal grid lines
  axis:    "#94A3B8",     // axis tick label color
};

export const CHART_AXIS_TICK = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  fill: CHART_COLORS.muted,
};

export const CHART_GRID_PROPS = {
  strokeDasharray: "3 3",
  stroke: CHART_COLORS.grid,
  vertical: false as const,
};

export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #EAECEF",
  borderRadius: 10,
  padding: "8px 12px",
  boxShadow: "0 8px 24px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)",
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
