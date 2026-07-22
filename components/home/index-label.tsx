"use client";

import React, { useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// IndexLabel — a section's story-beat index sitting as a NODE on the thread
// (cohesion pass C1/C2). A small ring on the left content rule fills blue and
// the mono label flips gray -> blue when the section arrives (the thread tip
// reaching it, approximated by first-in-view). Reduced-motion: arrived state.
// ---------------------------------------------------------------------------

export function IndexLabel({
  index,
  label,
  bg,
}: {
  index: string;
  label: string;
  bg: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  const reduce = useReducedMotion();
  const on = reduce ? true : inView;

  return (
    <span
      ref={ref}
      className="absolute left-4 md:left-8"
      // Sits just below the top rule (not negative) so it never clips under
      // the sticky nav on load (punch-list item 2). z above section atmosphere.
      style={{ top: 14, zIndex: 2, display: "inline-flex", alignItems: "center" }}
    >
      {/* node ring, centered on the thread */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: -5,
          top: 2,
          width: 11,
          height: 11,
          borderRadius: 999,
          backgroundColor: on ? "#0f62fe" : "#FFFFFF",
          border: `1.5px solid ${on ? "#0f62fe" : "#c9d4ea"}`,
          transition: "background-color 450ms ease, border-color 450ms ease",
        }}
      />
      <span
        style={{
          marginLeft: 12,
          paddingRight: 10,
          backgroundColor: bg,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.09em",
          // Stronger wayfinding contrast (punch-list items 9 + 12).
          color: on ? "#0f43b8" : "#5a647d",
          textTransform: "uppercase",
          transition: "color 450ms ease",
          whiteSpace: "nowrap",
        }}
      >
        {index} — {label}
      </span>
    </span>
  );
}
