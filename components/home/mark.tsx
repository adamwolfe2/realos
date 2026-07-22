"use client";

import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// Mark — signature marker-highlight on a headline keyword (cool pass M1;
// punch-list items 1 + 6). A clean, flat brand-tint block, ZERO rotation,
// tucked to the glyph's cap-height/baseline so it reads as a deliberate
// highlight, not accidental text selection. It sweeps in left->right once in
// view. `ruler` (used sparingly, deliberate annotations only) draws a dashed
// measurement line beneath. Reduced-motion renders the final state instantly.
// ---------------------------------------------------------------------------

export function Mark({
  children,
  ruler = false,
  className,
}: {
  children: React.ReactNode;
  ruler?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const reduce = useReducedMotion();
  const on = reduce ? true : inView;

  return (
    <span
      ref={ref}
      className={`relative inline-block ${className ?? ""}`}
      style={{ isolation: "isolate" }}
    >
      <motion.span
        aria-hidden
        initial={false}
        animate={{ scaleX: on ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
        style={{
          position: "absolute",
          top: "0.09em",
          right: "-0.05em",
          bottom: "0.11em",
          left: "-0.05em",
          zIndex: -1,
          scaleX: 0,
          transformOrigin: "left center",
          backgroundColor: "#d6e4ff",
          borderRadius: 1,
          willChange: "transform",
        }}
      />
      <span className="relative">{children}</span>
      {ruler ? <Ruler on={on} reduce={!!reduce} /> : null}
    </span>
  );
}

function Ruler({ on, reduce }: { on: boolean; reduce: boolean }) {
  return (
    <span
      aria-hidden
      className="absolute left-0 right-0"
      style={{ bottom: "-0.3em", height: 6, pointerEvents: "none" }}
    >
      <svg
        width="100%"
        height="6"
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }}
      >
        <motion.line
          x1="0"
          y1="3"
          x2="100"
          y2="3"
          stroke="#0f62fe"
          strokeOpacity="0.5"
          strokeWidth="1"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
          initial={false}
          animate={{ pathLength: on ? 1 : 0 }}
          transition={
            reduce ? { duration: 0 } : { duration: 0.45, delay: 0.4, ease: "easeInOut" }
          }
        />
        {[0, 100].map((x) => (
          <motion.line
            key={x}
            x1={x}
            y1="0"
            x2={x}
            y2="6"
            stroke="#0f62fe"
            strokeOpacity="0.5"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            initial={false}
            animate={{ opacity: on ? 1 : 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.3, delay: 0.7 }}
          />
        ))}
      </svg>
    </span>
  );
}
