"use client";

import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  AppFolioMark,
  GoogleMark,
  MetaMark,
  GA4Mark,
  SlackMark,
  CalcomMark,
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";
import { SourceGlyph } from "@/components/portal/reports/snapshot-shared";

// ---------------------------------------------------------------------------
// IntegrationsStrip — the "works with your stack" logo row. Landing v3
// (Adam 2026-07-23): promoted from mid-page into the hero, directly under
// the dashboard frame — the first proof after seeing the product is that it
// speaks to the stack the operator already runs. Tiles pop in a stagger.
// ---------------------------------------------------------------------------

const INTEGRATIONS: Array<{ name: string; mark: React.ReactNode }> = [
  { name: "AppFolio", mark: <AppFolioMark size={34} /> },
  { name: "Google", mark: <GoogleMark size={34} /> },
  { name: "Meta", mark: <MetaMark size={34} /> },
  { name: "GA4", mark: <GA4Mark size={34} /> },
  { name: "Slack", mark: <SlackMark size={34} /> },
  { name: "Cal.com", mark: <CalcomMark size={34} /> },
  { name: "ChatGPT", mark: <ChatGPTMark size={34} /> },
  { name: "Perplexity", mark: <PerplexityMark size={34} /> },
  { name: "Claude", mark: <ClaudeMark size={34} /> },
  { name: "Gemini", mark: <GeminiMark size={34} /> },
  // Review sources we monitor — rounds the grid to 12 (3×4 on mobile).
  { name: "Reddit", mark: <SourceGlyph source="REDDIT" className="h-8 w-8" /> },
  { name: "Yelp", mark: <SourceGlyph source="YELP" className="h-8 w-8" /> },
];

export function IntegrationsStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const on = reduce ? true : inView;

  return (
    <div ref={ref} className="text-center">
      <motion.p
        initial={false}
        animate={{ opacity: on ? 1 : 0, y: on ? 0 : 8 }}
        transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
        style={{
          color: "#161616",
          fontFamily: "var(--font-sans)",
          fontSize: "18px",
          fontWeight: 500,
          letterSpacing: "-0.015em",
        }}
      >
        Works with the PMS, ads, and reviews you already have.
      </motion.p>
      <motion.p
        initial={false}
        animate={{ opacity: on ? 1 : 0 }}
        transition={{ duration: 0.4, delay: reduce ? 0 : 0.12 }}
        className="mt-2"
        style={{
          color: "#6f6f6f",
          fontFamily: "var(--font-sans)",
          fontSize: "14.5px",
          lineHeight: 1.6,
        }}
      >
        AppFolio, Google, Meta, and your reviews, synced continuously.
      </motion.p>
      {/* 12 tiles: clean 3×4 on mobile, 6×2 from md up. */}
      <div className="mt-7 mx-auto grid grid-cols-3 md:grid-cols-6 gap-2.5 md:gap-3 max-w-[300px] md:max-w-[560px]">
        {INTEGRATIONS.map((it, i) => (
          <motion.span
            key={it.name}
            initial={false}
            animate={{ opacity: on ? 1 : 0, y: on ? 0 : 10, scale: on ? 1 : 0.92 }}
            transition={{ type: "spring", stiffness: 360, damping: 24, delay: reduce ? 0 : 0.15 + i * 0.05 }}
            whileHover={reduce ? undefined : { y: -3 }}
            className="inline-flex items-center justify-center aspect-square w-full"
            title={it.name}
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: 2,
              backgroundColor: "#FFFFFF",
            }}
          >
            {it.mark}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
