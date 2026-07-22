"use client";

import React, { useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
import { Eye } from "lucide-react";
import { ProductTour } from "@/components/product-tour";
import { ProductFrame } from "./product-frame";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { SectionShell, LabelChip } from "./section-shell";
import { Atmosphere } from "./atmosphere";

// ---------------------------------------------------------------------------
// ProductHeroShot — [02] The system catches it. A pinned scrollytelling beat
// (cohesion pass C3): a 220vh runway, the ProductFrame pinned sticky, and
// scroll progress driving three beats over an OVERLAY layer (never editing
// ProductTour internals). Each caption answers the question a buyer is
// silently asking at that moment. As the runway ends the frame scales down,
// handing off to the capabilities tabs below (zoom-out).
//
// Reduced-motion and mobile: normal flow, frame + three stacked answer cards,
// no pin. Nothing is ever trapped (sticky, not fixed; releases after 220vh).
// ---------------------------------------------------------------------------

const H2 = "Priya applied at 11:48pm. Nothing fell through.";

const BEATS = [
  { q: "Where do my leads actually go?", a: "Every signal lands in one place." },
  { q: "Can I trust the attribution?", a: "Attributed to source in real time." },
  {
    q: "And the traffic that never fills a form?",
    a: "Even the anonymous ones get named.",
  },
];

function FrameContent() {
  return (
    <>
      <div className="hidden md:block">
        <ProductTour />
      </div>
      <div className="md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marketing/product-tour-preview.png"
          alt="LeaseStack operator portal"
          loading="lazy"
          style={{ display: "block", width: "100%", height: "auto" }}
        />
        <div
          style={{
            padding: "16px 18px",
            borderTop: "1px solid #e0e0e0",
            backgroundColor: "#FFFFFF",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              lineHeight: 1.5,
              color: "#525252",
            }}
          >
            Open this page on a laptop to click through the live operator
            portal.
          </p>
          <BookDemoLink
            className="mt-3 inline-flex items-center"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 600,
              color: "#0f62fe",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Book a demo
          </BookDemoLink>
        </div>
      </div>
    </>
  );
}

function h2El() {
  return (
    <h2
      className="mt-4"
      style={{
        color: "#161616",
        fontFamily: "var(--font-sans)",
        fontSize: "clamp(28px, 3.4vw, 40px)",
        fontWeight: 500,
        lineHeight: 1.12,
        letterSpacing: "-0.025em",
        maxWidth: 720,
      }}
    >
      {H2}
    </h2>
  );
}

function Pinned() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  });
  const [beat, setBeat] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const b = v < 0.4 ? 0 : v < 0.72 ? 1 : 2;
    setBeat((p) => (p === b ? p : b));
  });

  const frameScale = useTransform(scrollYProgress, [0.85, 1], [1, 0.96]);
  const ringLeft = useTransform(scrollYProgress, [0.4, 0.56, 0.72], ["16%", "48%", "80%"]);
  const ringTop = useTransform(scrollYProgress, [0.4, 0.56, 0.72], ["26%", "58%", "44%"]);
  const ringOpacity = useTransform(scrollYProgress, [0.36, 0.42, 0.7, 0.76], [0, 1, 1, 0]);
  const toastOpacity = useTransform(scrollYProgress, [0.74, 0.82], [0, 1]);
  const toastY = useTransform(scrollYProgress, [0.74, 0.82], [16, 0]);

  return (
    <div ref={wrapRef} className="hidden md:block relative mk-pin-wrap">
      <div className="mk-pin">
        <div className="w-full py-12">
          <LabelChip>Operator portal</LabelChip>
          {h2El()}

          <div className="relative mt-8">
            <div
              aria-hidden
              className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
              style={{
                bottom: -28,
                width: "78%",
                height: 130,
                background:
                  "radial-gradient(50% 50% at 50% 50%, rgba(15,98,254,0.12), transparent 70%)",
                filter: "blur(26px)",
              }}
            />
            <motion.div
              style={{ scale: frameScale, transformOrigin: "center top" }}
            >
              <ProductFrame
                url="app.leasestack.co/portal"
                contentStyle={{ backgroundColor: "#fbfcfe" }}
              >
                <div className="relative">
                  <ProductTour />
                  {/* Beat b: scanning highlight ring travels the surfaces. */}
                  <motion.div
                    aria-hidden
                    className="absolute pointer-events-none"
                    style={{
                      left: ringLeft,
                      top: ringTop,
                      x: "-50%",
                      y: "-50%",
                      width: 130,
                      height: 92,
                      borderRadius: 8,
                      border: "2px solid #0f62fe",
                      boxShadow: "0 0 0 4px rgba(15,98,254,0.12)",
                      opacity: ringOpacity,
                    }}
                  />
                  {/* Beat c: identified-visitor toast slides in. */}
                  <motion.div
                    className="absolute pointer-events-none"
                    style={{
                      right: 20,
                      bottom: 20,
                      opacity: toastOpacity,
                      y: toastY,
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #e6ebf5",
                      borderRadius: 6,
                      padding: "10px 14px",
                      boxShadow:
                        "0 1px 2px rgba(22,22,22,0.06), 0 14px 28px -12px rgba(22,22,22,0.22)",
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="inline-flex items-center justify-center"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          backgroundColor: "rgba(15,98,254,0.10)",
                          color: "#0f62fe",
                        }}
                      >
                        <Eye className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden />
                      </span>
                      <div>
                        <p
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#161616",
                            lineHeight: 1.2,
                          }}
                        >
                          12 new identified visitors
                        </p>
                        <p
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10.5,
                            color: "#8d8d8d",
                          }}
                        >
                          Named by the pixel just now
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </ProductFrame>
            </motion.div>
          </div>

          {/* Buyer-question caption, crossfading per beat. */}
          <div className="mt-8 min-h-[64px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={beat}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    letterSpacing: "0.04em",
                    color: "#8d8d8d",
                  }}
                >
                  {BEATS[beat].q}
                </p>
                <p
                  className="mt-1.5"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "clamp(18px, 2vw, 22px)",
                    fontWeight: 500,
                    color: "#161616",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {BEATS[beat].a}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function NormalFlow({ className }: { className?: string }) {
  return (
    <div className={`py-16 ${className ?? ""}`}>
      <LabelChip>Operator portal</LabelChip>
      {h2El()}
      <div className="relative mt-8">
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            bottom: -24,
            width: "78%",
            height: 120,
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(15,98,254,0.12), transparent 70%)",
            filter: "blur(24px)",
          }}
        />
        <ProductFrame
          url="app.leasestack.co/portal"
          contentStyle={{ backgroundColor: "#fbfcfe" }}
        >
          <FrameContent />
        </ProductFrame>
      </div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {BEATS.map((b) => (
          <div
            key={b.q}
            style={{
              border: "1px solid #e0e6f4",
              borderRadius: 2,
              backgroundColor: "#f7f9fe",
              padding: "16px 18px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.04em",
                color: "#8d8d8d",
              }}
            >
              {b.q}
            </p>
            <p
              className="mt-1.5"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 16,
                fontWeight: 500,
                color: "#161616",
                lineHeight: 1.3,
              }}
            >
              {b.a}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductHeroShot() {
  const reduce = useReducedMotion();
  return (
    <SectionShell id="product-tour" index="02" indexLabel="The system catches it" bg="#FFFFFF">
      <div className="relative">
        <Atmosphere />
        <div className="relative">
          {!reduce ? <Pinned /> : null}
          <NormalFlow className={reduce ? "block" : "md:hidden"} />
        </div>
      </div>
    </SectionShell>
  );
}
