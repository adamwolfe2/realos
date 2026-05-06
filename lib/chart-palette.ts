// ---------------------------------------------------------------------------
// Shared chart color palette.
//
// Charts use raw hex values (SVG stroke/fill, recharts props) which means
// CSS variables don't reach them — every chart had its own ad-hoc palette
// hard-coded. That created drift: leasing velocity bars were one shade of
// emerald; visitor sources used a different shade; deltas were a third.
//
// This file is the single source of truth. Pick from CHART_SERIES_COLORS
// for categorical series (leads/tours/applications, sources, devices),
// CHART_NEUTRALS for grid + axis lines, and CHART_SEMANTIC for tone-based
// indicators (positive/negative/warning).
//
// Numeric ramps (intent score, occupancy %) should derive from
// CHART_SEMANTIC.primary at varying opacity rather than introducing
// new hexes — keeps the page feeling like one product, not three.
// ---------------------------------------------------------------------------

/**
 * Default categorical sequence for multi-series charts. Index into this
 * by series order, NOT by domain (so "leads" vs "tours" doesn't mean
 * "always blue vs always green" — it means "the first series shown" vs
 * "the second"). Most charts only show 2–3 series so the first three
 * matter most.
 */
export const CHART_SERIES_COLORS = [
  "#2563EB", // primary  — matches --color-primary
  "#0EA5A4", // teal     — distinct from primary at small swatches
  "#7C3AED", // violet   — replaces the prior #8B5CF6 for better contrast
  "#F59E0B", // amber    — kept for "warning"-adjacent series
  "#DC2626", // red      — destructive / churn
  "#475569", // slate    — fallback for >5 series
] as const;

/**
 * Neutrals used for chart chrome (axes, grid, faint reference lines).
 * Matches --color-border / --color-muted-foreground so the chart
 * blends with cards instead of fighting them.
 */
export const CHART_NEUTRALS = {
  grid: "#E5E7EB",
  axis: "#9CA3AF",
  axisLabel: "#6B7280",
  reference: "#CBD5E1",
} as const;

/**
 * Tone-based colors. Use these for indicators that have semantic
 * meaning (good/bad/warning), not for series identity. They match the
 * site palette exactly so a green dot on a chart looks like the green
 * pill on a card.
 */
export const CHART_SEMANTIC = {
  primary: "#2563EB",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#DC2626",
  muted: "#9CA3AF",
} as const;
