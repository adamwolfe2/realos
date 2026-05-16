/**
 * Centralized blue chart palette for LeaseStack.
 *
 * LeaseStack is a blue-branded product (primary #2563EB). Every chart,
 * donut slice, bar fill, activity-feed accent, KPI sparkline, etc.
 * should pull its colors from this file so we never drift back to the
 * grayscale / near-black palette that crept into the platform-showcase
 * and a few legacy attribution surfaces.
 *
 * Usage:
 *   import { BRAND_BLUE, BLUE_SCALE, BLUE_DONUT_PALETTE } from "@/lib/charts/palette";
 */

// Primary brand
export const BRAND_BLUE = "#2563EB"; // primary — buttons, links, top-of-funnel
export const BRAND_BLUE_DARK = "#1D4ED8"; // hover / pressed
export const BRAND_BLUE_LIGHT = "#3B82F6"; // accent / second-tier slice

// Tailwind blue scale, picked for accessibility against white surfaces.
// Sorted dark → light so a `.slice(0, n)` for a small dataset still
// reads as a coherent gradient.
export const BLUE_SCALE = [
  "#1E3A8A", // blue-900
  "#1D4ED8", // blue-700
  "#2563EB", // blue-600 (primary)
  "#3B82F6", // blue-500
  "#60A5FA", // blue-400
  "#93C5FD", // blue-300
  "#BFDBFE", // blue-200
  "#DBEAFE", // blue-100
] as const;

// Donut chart palette — primary blue first, then descending tints. Use
// this for any pie/donut where the user expects "more blue = bigger
// slice". Capped at 8 colors; anything beyond rolls into "Other" tinted
// muted gray (#CBD5E1) — the ONLY non-blue color allowed here, kept
// strictly for the catch-all bucket.
export const BLUE_DONUT_PALETTE = [
  "#2563EB", // primary
  "#3B82F6",
  "#60A5FA",
  "#93C5FD",
  "#1D4ED8",
  "#1E3A8A",
  "#BFDBFE",
  "#DBEAFE",
] as const;

// "Other" / unattributed bucket — soft slate so it visually recedes
// behind the blue family.
export const OTHER_SLICE = "#CBD5E1";

// Bar fills — funnel + horizontal "rank" lists. Top stage uses primary,
// subsequent stages step down through the blue scale for a visual
// drop-off.
export const FUNNEL_STAGE_FILLS = [
  "#2563EB",
  "#3B82F6",
  "#60A5FA",
  "#93C5FD",
  "#BFDBFE",
] as const;

// Track / empty-bar backgrounds — neutral cool gray so blue bars pop.
export const TRACK_FILL = "#EFF6FF"; // blue-50, sits under blue bars
export const TRACK_BORDER = "#E5E7EB"; // standard border

// Sparkline / line-chart stroke
export const SPARKLINE_STROKE = "#2563EB";
export const SPARKLINE_AREA = "rgba(37, 99, 235, 0.10)";

// Activity-feed accent dots / icon circles
export const ACTIVITY_ACCENTS = {
  lead: "#2563EB",
  tour: "#1D4ED8",
  pixel: "#3B82F6",
  review: "#60A5FA",
  default: "#2563EB",
} as const;

/**
 * Pick a color from the blue donut palette by index, wrapping around.
 * Falls back to OTHER_SLICE for the last bucket when `isOther` is set.
 */
export function pickDonutColor(idx: number, isOther = false): string {
  if (isOther) return OTHER_SLICE;
  return BLUE_DONUT_PALETTE[idx % BLUE_DONUT_PALETTE.length];
}
