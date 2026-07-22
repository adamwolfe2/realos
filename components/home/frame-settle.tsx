"use client";

import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

// ---------------------------------------------------------------------------
// FrameSettle — the product frame settles into place (depth addendum sec 2 +
// motion pass sec 2). Perspective wrapper; the frame starts tilted back
// (rotateX 5deg, scale .98) and settles flat once on first view. Honors
// prefers-reduced-motion (renders flat immediately, no transition).
// ---------------------------------------------------------------------------

export function FrameSettle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const reduce = useReducedMotion();
  const settled = reduce ? true : inView;

  return (
    <div ref={ref} className={className} style={{ perspective: "1600px" }}>
      <motion.div
        initial={false}
        animate={{
          rotateX: settled ? 0 : 5,
          scale: settled ? 1 : 0.98,
          opacity: settled ? 1 : 0,
        }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }
        }
        style={{ transformOrigin: "center top", willChange: "transform, opacity" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
