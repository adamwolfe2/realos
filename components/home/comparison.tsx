"use client";

import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  Globe,
  MessageSquare,
  Star,
  Building2,
  Table2,
  FileSignature,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";
import { MARKETING } from "@/lib/copy/marketing";
import { MaskRevealUp } from "@/components/ui/animate-text";
import { GoogleMark } from "@/components/platform/artifacts/brand-logos";
import { ProductFrame } from "./product-frame";

// ---------------------------------------------------------------------------
// Comparison — landing v3 item 2. The five text rows are gone; the picture
// does the arguing. LEFT: the operator's actual today — six disconnected
// vendor cards, muted, tilted, six-invoices vibe. MIDDLE: the same six
// sources drawn as flow lines converging into one frame. RIGHT: a mini
// LeaseStack dashboard — the funnel down to the signed lease and ONE bold
// outcome line. Total section copy: the headline + that line.
// ---------------------------------------------------------------------------

const INK = "#161616";
const MUTED = "#6f6f6f";
const FAINT = "#8d8d8d";
const ACCENT = "#0f62fe";
const BORDER = "#e0e0e0";
const EASE = [0.22, 1, 0.36, 1] as const;

type Vendor = {
  name: string;
  meta: string;
  mark: React.ReactNode;
  // scatter placement (desktop)
  left: string;
  top: number;
  rotate: number;
};

function LucideMark({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="w-3.5 h-3.5" strokeWidth={1.9} style={{ color: MUTED }} aria-hidden />;
}

const VENDORS: Vendor[] = [
  { name: "Website vendor", meta: "Login 1 · own invoice", mark: <LucideMark icon={Globe} />, left: "3%", top: 10, rotate: -2.4 },
  { name: "Google Ads", meta: "Login 2 · own report", mark: <GoogleMark size={14} />, left: "51%", top: 0, rotate: 2 },
  { name: "Chatbot vendor", meta: "Login 3 · own invoice", mark: <LucideMark icon={MessageSquare} />, left: "8%", top: 118, rotate: 1.6 },
  { name: "Reviews tool", meta: "Login 4 · own report", mark: <LucideMark icon={Star} />, left: "55%", top: 128, rotate: -1.8 },
  { name: "ILS listings", meta: "Login 5 · own invoice", mark: <LucideMark icon={Building2} />, left: "1%", top: 232, rotate: 2.2 },
  { name: "The spreadsheet", meta: "The “integration”", mark: <LucideMark icon={Table2} />, left: "47%", top: 248, rotate: -2.6 },
];

const FUNNEL = [
  { label: "Visitors", value: "12,480", w: 100 },
  { label: "Leads", value: "168", w: 62 },
  { label: "Tours", value: "31", w: 38 },
  { label: "Applications", value: "11", w: 22 },
  { label: "Signed leases", value: "4", w: 12 },
];

// Scattered "today" cards. Tilted + muted; hover straightens one out — the
// card wants to be organized.
function ScatterCards({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto w-full max-w-[420px]" style={{ height: 330 }}>
      {VENDORS.map((v, i) => (
        <motion.div
          key={v.name}
          initial={false}
          animate={
            reduce
              ? { opacity: 1, y: 0, rotate: v.rotate }
              : { opacity: on ? 1 : 0, y: on ? 0 : 16, rotate: on ? v.rotate : 0 }
          }
          whileHover={reduce ? undefined : { rotate: 0, scale: 1.02 }}
          transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : i * 0.07 }}
          className="absolute"
          style={{
            left: v.left,
            top: v.top,
            width: "46%",
            minWidth: 168,
            backgroundColor: "#fbfbfb",
            border: `1px solid ${BORDER}`,
            borderRadius: 2,
            padding: "12px 14px",
            boxShadow: "0 1px 2px rgba(22,22,22,0.05), 0 10px 20px -12px rgba(22,22,22,0.12)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 22, height: 22, borderRadius: 2, backgroundColor: "#f0f1f4" }} aria-hidden>
              {v.mark}
            </span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "#525252" }}>{v.name}</span>
          </div>
          <p className="mt-1.5" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: FAINT }}>
            {v.meta}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

// Desktop-only converge lines: six paths flowing into one point, each tipped
// with the vendor's mark. Draws once on view.
function FlowLines({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  const ys = [28, 86, 144, 202, 260, 318];
  return (
    <div className="relative hidden lg:block" style={{ width: 96, height: 346 }} aria-hidden>
      <svg width="96" height="346" viewBox="0 0 96 346" fill="none" style={{ position: "absolute", inset: 0 }}>
        {ys.map((y, i) => (
          <motion.path
            key={y}
            d={`M 14 ${y} C 56 ${y}, 56 173, 94 173`}
            stroke={ACCENT}
            strokeOpacity={0.45}
            strokeWidth={1.5}
            initial={false}
            animate={{ pathLength: reduce ? 1 : on ? 1 : 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: reduce ? 0 : 0.15 + i * 0.08 }}
          />
        ))}
      </svg>
      {VENDORS.map((v, i) => (
        <span
          key={v.name}
          className="absolute inline-flex items-center justify-center"
          style={{
            left: 2,
            top: ys[i] - 12,
            width: 24,
            height: 24,
            borderRadius: 999,
            backgroundColor: "#FFFFFF",
            border: `1px solid ${BORDER}`,
          }}
        >
          {v.mark}
        </span>
      ))}
    </div>
  );
}

// Mobile connector: the six marks in a row + a down arrow.
function FlowRow() {
  return (
    <div className="lg:hidden flex flex-col items-center gap-2 py-6" aria-hidden>
      <div className="flex items-center gap-2">
        {VENDORS.map((v) => (
          <span
            key={v.name}
            className="inline-flex items-center justify-center"
            style={{ width: 26, height: 26, borderRadius: 999, backgroundColor: "#FFFFFF", border: `1px solid ${BORDER}` }}
          >
            {v.mark}
          </span>
        ))}
      </div>
      <ArrowDown className="w-4 h-4" strokeWidth={1.8} style={{ color: ACCENT }} />
    </div>
  );
}

// The resolution: one mini dashboard frame — funnel to signed lease + the
// single outcome line.
function MiniDashboard({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  return (
    <ProductFrame url="app.leasestack.co/portal">
      <div style={{ padding: "16px 18px", backgroundColor: "#FFFFFF" }}>
        <div className="flex items-center justify-between">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: FAINT }}>
            One dashboard · last 28 days
          </p>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: FAINT, border: `1px solid ${BORDER}`, borderRadius: 2, padding: "1px 6px" }}>
            Sample data
          </span>
        </div>
        <div className="flex flex-col gap-2.5 mt-4">
          {FUNNEL.map((f, i) => (
            <div key={f.label} className="flex items-center gap-3">
              <span style={{ width: 92, fontFamily: "var(--font-sans)", fontSize: 12, color: MUTED, flexShrink: 0 }}>{f.label}</span>
              <div style={{ flex: 1, height: 14, backgroundColor: "#eef1f8", borderRadius: 2, overflow: "hidden" }}>
                <motion.div
                  initial={false}
                  animate={{ width: reduce ? `${f.w}%` : on ? `${f.w}%` : "0%" }}
                  transition={{ duration: 0.7, ease: EASE, delay: reduce ? 0 : 0.3 + i * 0.08 }}
                  style={{ height: "100%", backgroundColor: ACCENT, borderRadius: 2 }}
                />
              </div>
              <span style={{ width: 50, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {f.value}
              </span>
            </div>
          ))}
        </div>

        {/* THE outcome line — the whole argument in one sentence. */}
        <motion.div
          initial={false}
          animate={reduce ? { opacity: 1, y: 0 } : { opacity: on ? 1 : 0, y: on ? 0 : 8 }}
          transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.85 }}
          className="flex items-center gap-2.5 mt-5"
          style={{ padding: "11px 13px", borderRadius: 2, backgroundColor: "rgba(36,161,72,0.08)", border: "1px solid rgba(36,161,72,0.2)" }}
        >
          <FileSignature className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} style={{ color: "#24a148" }} aria-hidden />
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 600, color: INK, lineHeight: 1.35 }}>
            This lease came from Google Ads.{" "}
            <span style={{ fontWeight: 400, color: MUTED }}>You can see it.</span>
          </p>
        </motion.div>
      </div>
    </ProductFrame>
  );
}

export function Comparison() {
  const { comparison } = MARKETING.home;
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, { once: true, margin: "0px 0px -18% 0px" });

  return (
    <section style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="max-w-3xl mb-10 md:mb-14">
          <h2
            style={{
              color: INK,
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(28px, 3.6vw, 40px)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            <MaskRevealUp lines={["Your current setup", "vs. one dashboard."]} />
          </h2>
        </div>

        <div ref={ref} className="grid grid-cols-1 lg:grid-cols-[1fr_96px_1.1fr] gap-x-6 items-center">
          {/* TODAY */}
          <div>
            <p
              className="mb-5"
              style={{ color: FAINT, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 600 }}
            >
              {comparison.leftLabel}
            </p>
            <ScatterCards on={on} />
          </div>

          {/* The same six sources, flowing into one place. */}
          <FlowLines on={on} />
          <FlowRow />

          {/* WITH LEASESTACK */}
          <div>
            <p
              className="mb-5"
              style={{ color: ACCENT, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700 }}
            >
              {comparison.rightLabel}
            </p>
            <MiniDashboard on={on} />
          </div>
        </div>
      </div>
    </section>
  );
}
