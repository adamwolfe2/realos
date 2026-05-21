import React from "react";

// ---------------------------------------------------------------------------
// SoftFramedArtifact — the Cluely.ai-inspired "lavender soft outer card
// framing a crisp white inner mockup" pattern Norman flagged on 2026-05-21.
//
// Two-layer rounded surface:
//   - OUTER: soft lavender/blue gradient with generous rounded corners
//     and a faint shadow. Acts as the "stage" — gives the inner content
//     room to breathe and a brand-coloured frame.
//   - INNER: pure white card with a soft drop shadow and tighter rounded
//     corners. Holds the actual product mockup, transcript, dashboard
//     snippet, whatever — totally agnostic about content.
//
// Padding on the outer card is deliberately generous (32-56px) so the
// inner card floats in a halo of lavender. The shadow on the inner card
// is subtle and warm (rgba(15,23,42,0.06)) rather than the deep gray
// shadow you get from default Tailwind shadow-lg — keeps it feeling
// "lifted" rather than "boxed".
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
  /** Optional label above the inner card — small mono "REAL-TIME" /
   *  "LIVE" style chip, matching the Cluely "Cluely listens" pill. */
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

const FRAME_TONES: Record<
  NonNullable<SoftFramedArtifactProps["tone"]>,
  string
> = {
  // Cluely-style lavender: top-left lighter wash → bottom-right slightly
  // deeper. Reads as cool, premium, and unmistakably brand-blue without
  // saturating the whole surface.
  lavender:
    "linear-gradient(135deg, #E8ECFF 0%, #DCE4FF 40%, #C9D5FF 100%)",
  sky:
    "linear-gradient(135deg, #E6F0FF 0%, #D6E4FF 50%, #B8CDFF 100%)",
  mint:
    "linear-gradient(135deg, #E8F4F0 0%, #D8EDE4 50%, #C0DCD0 100%)",
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
      className={`relative rounded-[28px] ${PADDING_SCALE[padding]} ${className ?? ""}`}
      style={{
        background: FRAME_TONES[tone],
        // Soft outer shadow — a hint of depth, not a hard drop.
        boxShadow:
          "0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px rgba(37, 99, 235, 0.08)",
      }}
    >
      {pillLabel ? (
        <span
          className="absolute top-6 right-6 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            fontWeight: 600,
            color: "#2563EB",
            textTransform: "uppercase",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
          }}
        >
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "#2563EB" }}
          />
          {pillLabel}
        </span>
      ) : null}
      {bare ? (
        // Child brings its own surface — skip the inner white wrapper
        // to avoid the double-frame look.
        <>{children}</>
      ) : (
        <div
          className="rounded-2xl bg-white overflow-hidden"
          style={{
            // Subtle warm shadow that reads as "lifted" not "boxed".
            boxShadow:
              "0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
