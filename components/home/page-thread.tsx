"use client";

import React from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// PageThread — THE THREAD (cohesion pass C1). One continuous blue spine that
// runs down the left content rule for the whole page. It draws progressively
// with scroll (useScroll -> scaleY): ahead of the tip the rule is dashed
// gray, behind it solid blue, and a pulse dot rides the tip. The [0N] index
// nodes (rendered by each SectionShell via IndexLabel) sit ON this line and
// fill on arrival.
//
// The overlay lives in the same max-w container as every section, pinned to
// left-4/left-8, so it aligns exactly with the section rules and index nodes.
// Reduced-motion: fully drawn, no pulse. Mobile: thinner, far-left gutter.
// ---------------------------------------------------------------------------

export function PageThread({
  target,
}: {
  target: React.RefObject<HTMLElement | null>;
}) {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target,
    offset: ["start start", "end end"],
  });
  const pulseTop = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
      <div className="relative max-w-[1240px] mx-auto px-4 md:px-8 h-full">
        <div className="absolute inset-y-0 left-4 md:left-8">
          {/* Gray dashed base (the not-yet-reached rule). */}
          <div
            className="absolute inset-y-0 left-0"
            style={{ borderLeft: "1px dashed #d9dff0" }}
          />
          {/* Blue solid draw, growing from the top with scroll. */}
          <motion.div
            className="absolute inset-y-0 left-0"
            style={{
              borderLeft: "1.5px solid #0f62fe",
              transformOrigin: "top center",
              scaleY: reduce ? 1 : scrollYProgress,
            }}
          />
          {/* Pulse dot riding the draw tip. */}
          {!reduce ? (
            <motion.div
              className="absolute"
              style={{
                top: pulseTop,
                left: -3.5,
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: "#0f62fe",
                boxShadow: "0 0 0 4px rgba(15,98,254,0.15)",
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
