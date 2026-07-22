"use client";

import React, { useRef } from "react";
import { PageThread } from "./page-thread";

// ---------------------------------------------------------------------------
// HomeThreadFrame — client wrapper that owns the page scroll ref so the
// PageThread (cohesion pass C1) can draw against the full page height. The
// homepage sections are passed through as children (server components render
// fine inside this client boundary).
// ---------------------------------------------------------------------------

export function HomeThreadFrame({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="relative"
      style={{ backgroundColor: "#FFFFFF", color: "#161616" }}
    >
      <PageThread target={ref} />
      {children}
    </div>
  );
}
