/**
 * Centralized blue chart palette for LeaseStack.
 *
 * LeaseStack is a blue-branded product (primary #0f62fe). Every chart,
 * donut slice, bar fill, activity-feed accent, KPI sparkline, etc.
 * should pull its colors from this file so we never drift back to the
 * grayscale / near-black palette that crept into the platform-showcase
 * and a few legacy attribution surfaces.
 *
 * Usage:
 *   import { BRAND_BLUE, BLUE_SCALE, BLUE_DONUT_PALETTE } from "@/lib/charts/palette";
 */

// Primary brand
export const BRAND_BLUE = "#0f62fe"; // primary — buttons, links, top-of-funnel

// IBM Carbon blue scale (see app/globals.css), dark to light.
// Sorted dark → light so a `.slice(0, n)` for a small dataset still
// reads as a coherent gradient.
export const BLUE_SCALE = [
  "#001d6c", // Carbon blue 90
  "#0043ce", // Carbon blue 70
  "#0f62fe", // Carbon blue 60 (primary)
  "#4589ff", // Carbon blue 50
  "#78a9ff", // Carbon blue 40
  "#a6c8ff", // Carbon blue 30
  "#d0e2ff", // Carbon blue 20
  "#edf5ff", // Carbon blue 10
] as const;

// Donut chart palette — primary blue first, then descending tints. Use
// this for any pie/donut where the user expects "more blue = bigger
// slice". Capped at 8 colors; anything beyond rolls into "Other" tinted
// muted gray (#CBD5E1) — the ONLY non-blue color allowed here, kept
// strictly for the catch-all bucket.
export const BLUE_DONUT_PALETTE = [
  "#0f62fe", // primary
  "#4589ff",
  "#78a9ff",
  "#a6c8ff",
  "#0043ce",
  "#001d6c",
  "#d0e2ff",
  "#edf5ff",
] as const;

// "Other" / unattributed bucket — soft slate so it visually recedes
// behind the blue family.
export const OTHER_SLICE = "#CBD5E1";

// Bar fills — funnel + horizontal "rank" lists. Top stage uses primary,
// subsequent stages step down through the blue scale for a visual
// drop-off.
export const FUNNEL_STAGE_FILLS = [
  "#0f62fe",
  "#4589ff",
  "#78a9ff",
  "#a6c8ff",
  "#d0e2ff",
] as const;

// Track / empty-bar backgrounds — neutral cool gray so blue bars pop.
export const TRACK_FILL = "#edf5ff";
