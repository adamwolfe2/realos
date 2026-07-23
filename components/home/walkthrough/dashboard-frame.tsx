"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ProductFrame } from "../product-frame";
import { WalkthroughShell, APP_BG } from "./shell";
import { ScreenBriefing } from "./screen-briefing";
import { ScreenDashboard } from "./screen-dashboard";
import { ScreenLeads } from "./screen-leads";
import { ScreenVisitors } from "./screen-visitors";
import { ScreenChatbot } from "./screen-chatbot";
import { MobileScreen } from "./mobile-screens";

// ---------------------------------------------------------------------------
// DashboardFrame — THE reusable full-product mock (landing v3 items 3 + 5).
// One browser-chromed portal window: real sidebar + topbar chrome around the
// beat's full screen replica. Rendered at a natural design width and scaled
// to whatever container it sits in, so density always reads as real software
// (a screenshot of the product), never as slideware.
//
// The shell chrome is PERSISTENT across beat changes — only the content pane
// crossfades and the sidebar active state slides, so switching beats feels
// like navigating the actual app, not swapping slides.
// ---------------------------------------------------------------------------

const SCREENS = [
  ScreenBriefing,
  ScreenDashboard,
  ScreenLeads,
  ScreenVisitors,
  ScreenChatbot,
];

// Per-beat address bar — the URL changing with the sidebar is the cheapest
// "this is a real app" tell there is.
const URLS = [
  "app.leasestack.co/portal/briefing",
  "app.leasestack.co/portal",
  "app.leasestack.co/portal/leads",
  "app.leasestack.co/portal/visitors",
  "app.leasestack.co/portal/conversations",
];

const SHELL_H = 560; // WalkthroughShell fixed height
const CHROME_H = 40; // ProductFrame chrome bar

// Scales its children (laid out at `natural` px wide) to fit the container.
// Height follows the scale so the layout never reserves phantom space.
function ScaleBox({
  natural,
  naturalH,
  maxScale = 1,
  children,
}: {
  natural: number;
  naturalH: number;
  maxScale?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setScale(Math.min(maxScale, el.clientWidth / natural));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [natural, maxScale]);

  const s = scale ?? Math.min(maxScale, 1);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <div
        style={{
          height: naturalH * s,
          position: "relative",
          overflow: "hidden",
          // Center when the container is wider than the capped frame.
          display: "flex",
          justifyContent: "center",
          opacity: scale === null ? 0 : 1,
          transition: "opacity 200ms ease",
        }}
      >
        <div
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

export function DashboardFrame({
  beat,
  natural = 1040,
  className,
}: {
  /** 0 briefing · 1 dashboard · 2 leads · 3 visitors · 4 chatbot */
  beat: number;
  /** Natural design width the frame is laid out at before scaling. */
  natural?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const Screen = SCREENS[beat] ?? ScreenDashboard;

  return (
    <div className={className}>
      <ScaleBox natural={natural} naturalH={SHELL_H + CHROME_H}>
        <ProductFrame url={URLS[beat] ?? URLS[1]}>
          <WalkthroughShell active={beat}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={beat}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
                style={{ height: "100%" }}
              >
                <Screen />
              </motion.div>
            </AnimatePresence>
          </WalkthroughShell>
        </ProductFrame>
      </ScaleBox>
    </div>
  );
}

// Phone-width variant: the readable stacked-card screen inside the same
// browser chrome, so small viewports still see "the product in a window"
// rather than a floating marketing card.
export function MobileFrame({
  beat,
  className,
}: {
  beat: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <ProductFrame url={URLS[beat] ?? URLS[1]}>
        {/* textAlign left: same inherited-centering guard as WalkthroughShell. */}
        <div style={{ padding: 12, backgroundColor: APP_BG, textAlign: "left" }}>
          <MobileScreen beat={beat} />
        </div>
      </ProductFrame>
    </div>
  );
}
