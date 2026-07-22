import React from "react";

// ---------------------------------------------------------------------------
// SoftFramedArtifact — flat Carbon-forward frame around a product mockup.
//
// Deslop pass (2026-07-21): dropped the lavender/sky/mint gradient stage
// and the 28px rounded corners (Cluely-style "soft card" pattern) for a
// flat single-tone frame with sharp 2px corners, matching DESIGN.md
// (light-only, flat elevation, no glow/gradient). The `tone` prop stays
// for API compatibility but every tone now resolves to a flat neutral or
// brand-tint fill, never a gradient.
//
// Two-layer surface:
//   - OUTER: flat frame, 1px hairline border, sharp corners. Gives the
//     inner content room to breathe.
//   - INNER: white card with a flat 1px border + soft shadow. Holds the
//     actual product mockup, transcript, dashboard snippet, whatever.
//
// Use cases:
//   - Hero artifacts on marketing sections (large, max-w-xl+ children).
//   - Inline mockups in the "Sanity check" sticky pattern.
//   - Standalone product callouts.
// ---------------------------------------------------------------------------

export type SoftFramedArtifactProps = {
  /** The white inner card content (mockup, chart, transcript, etc). */
  children: React.ReactNode;
  /**
   * Tone of the outer frame. Lavender (default) matches the Cluely
   * reference. Sky is a slightly cooler blue. Mint is a fresh accent
   * for sections that want a different rhythm (Verticals, Proof).
   */
  tone?: "lavender" | "sky" | "mint";
  /** Outer-padding scale. "lg" (default) gives the inner card a generous
   *  halo; "md" tightens for surfaces where vertical space is tight. */
  padding?: "md" | "lg";
  /** Optional label above the inner card — small mono chip. Demo-data
   *  honesty convention: fabricated/simulated content must be labeled
   *  "Example data" (neutral tone), never "LIVE". */
  pillLabel?: string;
  /** Optional className passthrough on the outer wrapper. */
  className?: string;
  /**
   * When the child already has its own rounded surface + shadow (e.g.
   * ConfigTabs ships with its own white card), set `bare` to skip the
   * inner white wrapper — the lavender frame just provides the halo
   * of padding around the child's own surface. Avoids the "double
   * frame" look where two rounded cards stack with visible borders.
   */
  bare?: boolean;
};

// Flat single-tone fills, no gradients. `lavender` keeps a faint brand-blue
// wash; `sky` and `mint` resolve to the same neutral Carbon gray so the
// surface never introduces an off-palette accent color.
const FRAME_TONES: Record<
  NonNullable<SoftFramedArtifactProps["tone"]>,
  string
> = {
  lavender: "#EEF3FF",
  sky: "#f4f4f4",
  mint: "#f4f4f4",
};

const PADDING_SCALE: Record<
  NonNullable<SoftFramedArtifactProps["padding"]>,
  string
> = {
  md: "p-6 md:p-10",
  lg: "p-8 md:p-14",
};

export function SoftFramedArtifact({
  children,
  tone = "lavender",
  padding = "lg",
  pillLabel,
  className,
  bare,
}: SoftFramedArtifactProps) {
  return (
    <div
      className={`relative rounded-[2px] ${PADDING_SCALE[padding]} ${className ?? ""}`}
      style={{
        backgroundColor: FRAME_TONES[tone],
        border: "1px solid #e0e0e0",
      }}
    >
      {pillLabel ? (
        <span
          className="absolute top-6 right-6 inline-flex items-center rounded-full bg-white px-3 py-1"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            fontWeight: 600,
            color: "var(--color-muted-foreground)",
            textTransform: "uppercase",
            border: "1px solid #e0e0e0",
          }}
        >
          {pillLabel}
        </span>
      ) : null}
      {bare ? (
        // Child brings its own surface — skip the inner white wrapper
        // to avoid the double-frame look.
        <>{children}</>
      ) : (
        <div
          className="rounded-[2px] bg-white overflow-hidden"
          style={{
            border: "1px solid #e0e0e0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
