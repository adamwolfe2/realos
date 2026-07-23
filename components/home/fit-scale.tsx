"use client";

import React, { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// FitScale — scales a block laid out at a fixed `natural` width down to fit
// its container, tracking the CHILD's real height (unlike the fixed-height
// ScaleBox in dashboard-frame). Built for document artifacts whose height is
// content-driven (the report one-pager). Centered when the container is
// wider than the capped frame.
// ---------------------------------------------------------------------------

export function FitScale({
  natural,
  maxScale = 1,
  children,
}: {
  natural: number;
  maxScale?: number;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [innerH, setInnerH] = useState<number | null>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      setScale(Math.min(maxScale, outer.clientWidth / natural));
      setInnerH(inner.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [natural, maxScale]);

  const s = scale ?? 1;

  return (
    <div ref={outerRef} style={{ width: "100%" }}>
      <div
        style={{
          height: innerH != null ? innerH * s : undefined,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          justifyContent: "center",
          opacity: scale === null ? 0 : 1,
          transition: "opacity 200ms ease",
        }}
      >
        <div
          ref={innerRef}
          style={{
            width: natural,
            flexShrink: 0,
            transform: `scale(${s})`,
            transformOrigin: "top center",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
