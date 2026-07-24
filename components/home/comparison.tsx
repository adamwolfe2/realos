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
import {
  GoogleMark,
  MetaMark,
  GA4Mark,
  ChatGPTMark,
  ClaudeMark,
  PerplexityMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";
import { SourceGlyph, toMentionSource } from "@/components/portal/reports/snapshot-shared";
import { ProductFrame } from "./product-frame";
import { CountUp } from "./count-up";

// ---------------------------------------------------------------------------
// Comparison — landing v3 item 2, "all out" pass (Adam 2026-07-23). LEFT:
// eight disconnected vendor cards wearing real brand marks — the operator's
// actual today. MIDDLE: the same eight sources drawn as flow lines converging
// into one frame. RIGHT: a full snapshot-style dashboard (KPIs, funnel,
// sources with logos, reputation with source glyphs, AI-engine visibility)
// that FILLS ITSELF section by section once in view — the six-invoice mess
// becoming one live system. Copy stays at two lines: headline + outcome.
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
  left: string;
  top: number;
  rotate: number;
};

function LucideMark({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="w-3.5 h-3.5" strokeWidth={1.9} style={{ color: MUTED }} aria-hidden />;
}

const VENDORS: Vendor[] = [
  { name: "Website vendor", meta: "Login 1 · own invoice", mark: <LucideMark icon={Globe} />, left: "2%", top: 6, rotate: -2.4 },
  { name: "Google Ads", meta: "Login 2 · own report", mark: <GoogleMark size={14} />, left: "51%", top: 0, rotate: 2 },
  { name: "Meta Ads", meta: "Login 3 · own report", mark: <MetaMark size={14} />, left: "6%", top: 96, rotate: 1.6 },
  { name: "Chatbot vendor", meta: "Login 4 · own invoice", mark: <LucideMark icon={MessageSquare} />, left: "54%", top: 102, rotate: -1.8 },
  { name: "Reviews tool", meta: "Login 5 · own report", mark: <LucideMark icon={Star} />, left: "1%", top: 190, rotate: 2.2 },
  { name: "Analytics", meta: "Login 6 · own charts", mark: <GA4Mark size={14} />, left: "49%", top: 200, rotate: -1.5 },
  { name: "ILS listings", meta: "Login 7 · own invoice", mark: <LucideMark icon={Building2} />, left: "5%", top: 286, rotate: -2.1 },
  { name: "The spreadsheet", meta: "The “integration”", mark: <LucideMark icon={Table2} />, left: "52%", top: 296, rotate: 2.5 },
];

const FUNNEL = [
  { label: "Visitors", value: 12480, w: 100 },
  { label: "Leads", value: 168, w: 62 },
  { label: "Tours", value: 31, w: 38 },
  { label: "Applications", value: 11, w: 22 },
  { label: "Signed leases", value: 4, w: 12 },
];

const SOURCES = [
  { label: "Google Ads", share: 36, color: "#0043ce", mark: <GoogleMark size={11} /> },
  { label: "Meta", share: 27, color: "#0f62fe", mark: <MetaMark size={11} /> },
  { label: "Organic", share: 18, color: "#4589ff", mark: <LucideMark icon={Globe} /> },
  { label: "Referral", share: 10, color: "#78a9ff", mark: <LucideMark icon={Building2} /> },
];

const REVIEWS = [
  { source: "Google", count: 74 },
  { source: "Reddit", count: 18 },
  { source: "Facebook", count: 10 },
  { source: "Yelp", count: 26 },
];

const ENGINES = [
  { label: "ChatGPT", cited: "5/12", mark: <ChatGPTMark size={12} /> },
  { label: "Claude", cited: "6/12", mark: <ClaudeMark size={12} /> },
  { label: "Perplexity", cited: "8/15", mark: <PerplexityMark size={12} /> },
  { label: "Gemini", cited: "0/9", mark: <GeminiMark size={12} /> },
];

const REP_MAX = 74;

// Scattered "today" cards. Tilted + muted; hover straightens one out.
function ScatterCards({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto w-full max-w-[440px]" style={{ height: 372 }}>
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
          transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : i * 0.06 }}
          className="absolute"
          style={{
            left: v.left,
            top: v.top,
            width: "46%",
            minWidth: 164,
            backgroundColor: "#fbfbfb",
            border: `1px solid ${BORDER}`,
            borderRadius: 2,
            padding: "11px 13px",
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

// Desktop-only converge lines: eight marks flowing into one point.
function FlowLines({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  const H = 384;
  const ys = VENDORS.map((_, i) => 22 + i * ((H - 44) / (VENDORS.length - 1)));
  return (
    <div className="relative hidden lg:block" style={{ width: 96, height: H }} aria-hidden>
      <svg width="96" height={H} viewBox={`0 0 96 ${H}`} fill="none" style={{ position: "absolute", inset: 0 }}>
        {ys.map((y, i) => (
          <motion.path
            key={y}
            d={`M 14 ${y} C 56 ${y}, 56 ${H / 2}, 94 ${H / 2}`}
            stroke={ACCENT}
            strokeOpacity={0.45}
            strokeWidth={1.5}
            initial={false}
            animate={{ pathLength: reduce ? 1 : on ? 1 : 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: reduce ? 0 : 0.15 + i * 0.07 }}
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

// Mobile connector: the marks in a row + a down arrow.
function FlowRow() {
  return (
    <div className="lg:hidden flex flex-col items-center gap-2 py-6" aria-hidden>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
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

function Bar({ w, color, height, delay, on, radius = 2 }: { w: number; color: string; height: number; delay: number; on: boolean; radius?: number }) {
  return (
    <div style={{ flex: 1, height, backgroundColor: "#eef1f8", borderRadius: radius, overflow: "hidden" }}>
      <motion.div
        initial={false}
        animate={{ width: on ? `${w}%` : "0%" }}
        transition={{ duration: 0.65, ease: EASE, delay }}
        style={{ height: "100%", backgroundColor: color, borderRadius: radius }}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: FAINT }}>
      {children}
    </p>
  );
}

// The resolution: one snapshot-grade dashboard that fills itself in —
// KPIs count up, funnel grows, sources/reputation/AI visibility tick in,
// then the single outcome line lands.
function FullDashboard({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  const d = (t: number) => (reduce ? 0 : t);
  const rise = (delay: number) => ({
    initial: false as const,
    animate: { opacity: on ? 1 : 0, y: on ? 0 : 8 },
    transition: { duration: 0.4, ease: EASE, delay: d(delay) },
  });

  return (
    <ProductFrame url="app.leasestack.co/portal">
      <div style={{ padding: "14px 16px", backgroundColor: "#FFFFFF", textAlign: "left" }}>
        <div className="flex items-center justify-between">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: FAINT }}>
            One dashboard · last 28 days
          </p>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: FAINT, border: `1px solid ${BORDER}`, borderRadius: 2, padding: "1px 6px" }}>
            Sample data
          </span>
        </div>

        {/* KPI row — counts up first. */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: "Leads", to: 168 },
            { label: "Ad spend", to: 18240, prefix: "$" },
            { label: "Tours", to: 31 },
            { label: "Signed", to: 4 },
          ].map((k) => (
            <motion.div key={k.label} {...rise(0.15)} style={{ border: `1px solid ${BORDER}`, borderRadius: 2, padding: "7px 9px" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.08em", textTransform: "uppercase", color: FAINT }}>{k.label}</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 500, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                {on ? <CountUp to={k.to} prefix={k.prefix ?? ""} locale duration={0.8} /> : "0"}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Funnel. */}
        <motion.div {...rise(0.35)} className="mt-3">
          <SectionLabel>Conversion funnel</SectionLabel>
          <div className="flex flex-col gap-1.5 mt-2">
            {FUNNEL.map((f, i) => (
              <div key={f.label} className="flex items-center gap-2.5">
                <span style={{ width: 84, fontFamily: "var(--font-sans)", fontSize: 11, color: MUTED, flexShrink: 0 }}>{f.label}</span>
                <Bar w={f.w} color={ACCENT} height={11} delay={d(0.45 + i * 0.07)} on={on} />
                <span style={{ width: 46, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {f.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Sources + reputation — the vendors' logos, now living inside. */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <motion.div {...rise(0.8)}>
            <SectionLabel>Lead sources</SectionLabel>
            <div className="flex flex-col gap-1.5 mt-2">
              {SOURCES.map((s, i) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 13, height: 13 }} aria-hidden>{s.mark}</span>
                  <span style={{ width: 58, fontFamily: "var(--font-sans)", fontSize: 10.5, color: INK, flexShrink: 0 }}>{s.label}</span>
                  <Bar w={s.share * 2.4} color={s.color} height={6} radius={999} delay={d(0.9 + i * 0.06)} on={on} />
                  <span style={{ width: 28, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{s.share}%</span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div {...rise(1.0)}>
            <div className="flex items-center gap-1.5">
              <SectionLabel>Reputation</SectionLabel>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: INK }}>4.6</span>
              <span style={{ fontSize: 9, color: ACCENT, letterSpacing: 1 }}>★★★★★</span>
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              {REVIEWS.map((r, i) => (
                <div key={r.source} className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 13, height: 13 }} aria-hidden>
                    <SourceGlyph source={toMentionSource(r.source)} className="h-3 w-3" />
                  </span>
                  <span style={{ width: 58, fontFamily: "var(--font-sans)", fontSize: 10.5, color: INK, flexShrink: 0 }}>{r.source}</span>
                  <Bar w={(r.count / REP_MAX) * 100} color={ACCENT} height={6} radius={999} delay={d(1.1 + i * 0.06)} on={on} />
                  <span style={{ width: 28, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{r.count}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* AI search visibility — engine marks tick in. */}
        <motion.div {...rise(1.45)} className="mt-3">
          <SectionLabel>AI search · times cited</SectionLabel>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {ENGINES.map((e, i) => (
              <motion.div
                key={e.label}
                initial={false}
                animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.9 }}
                transition={{ type: "spring", stiffness: 380, damping: 24, delay: d(1.55 + i * 0.1) }}
                className="flex items-center gap-1.5"
                style={{ border: `1px solid ${BORDER}`, borderRadius: 2, padding: "5px 8px" }}
              >
                <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 14, height: 14 }} aria-hidden>{e.mark}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>{e.cited}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* THE outcome line — the whole argument in one sentence. */}
        <motion.div
          initial={false}
          animate={reduce ? { opacity: 1, y: 0 } : { opacity: on ? 1 : 0, y: on ? 0 : 8 }}
          transition={{ duration: 0.5, ease: EASE, delay: d(2.0) }}
          className="flex items-center gap-2.5 mt-3"
          style={{ padding: "10px 12px", borderRadius: 2, backgroundColor: "rgba(36,161,72,0.08)", border: "1px solid rgba(36,161,72,0.2)" }}
        >
          <FileSignature className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} style={{ color: "#24a148" }} aria-hidden />
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: INK, lineHeight: 1.35 }}>
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

        <div ref={ref} className="grid grid-cols-1 lg:grid-cols-[1fr_96px_1.15fr] gap-x-6 items-center">
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

          {/* The same eight sources, flowing into one place. */}
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
            <FullDashboard on={on} />
          </div>
        </div>
      </div>
    </section>
  );
}
