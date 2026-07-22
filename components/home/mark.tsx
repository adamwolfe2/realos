"use client";

import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// Mark — signature marker-highlight on a headline keyword (cool pass M1 +
// motion pass sec 1/9). A brand-tinted, lightly-textured highlighter block
// sweeps in left->right behind the phrase (scaleX, origin left, once). With
// `ruler`, a dashed measurement line + end ticks draw in underneath after.
//
// Restraint: max one Mark per section headline; at most two rulers on the
// page. Reduced-motion renders the final state instantly.
// ---------------------------------------------------------------------------

// Fractal-noise texture so the highlight reads like real marker ink, not a
// flat rectangle. Inline data-URI keeps it dependency-free.
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")";

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
          inset: "-1px -6px",
          zIndex: -1,
          rotate: -1,
          scaleX: 0,
          transformOrigin: "left center",
          backgroundColor: "rgba(214,228,255,0.85)",
          backgroundImage: NOISE,
          backgroundBlendMode: "multiply",
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
      style={{ bottom: "-0.32em", height: 6, pointerEvents: "none" }}
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
        {/* End ticks */}
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
