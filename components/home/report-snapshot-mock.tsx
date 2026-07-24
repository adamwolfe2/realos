"use client";

import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Globe, Building2 } from "lucide-react";
import {
  GoogleMark,
  MetaMark,
  ChatGPTMark,
  ClaudeMark,
  PerplexityMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";
import { SourceGlyph, toMentionSource } from "@/components/portal/reports/snapshot-shared";
import { ProductFrame } from "./product-frame";
import { FitScale } from "./fit-scale";
import { CountUp } from "./count-up";

// ---------------------------------------------------------------------------
// ReportSnapshotMock — the Monday report as a COMPACT selling shot (Adam
// 2026-07-23: the full one-pager render was way too tall). One dense
// two-column snapshot in the exact visual language of the hero/walkthrough
// dashboard frames — Carbon tokens, mono numerics, brand marks — that fills
// itself in on view: KPIs count up, source bars grow, the sparkline rises,
// renewals flag red, reputation + AI visibility tick in, coverage dots last.
// Same canonical sample numbers as everywhere else on the page.
// ---------------------------------------------------------------------------

const INK = "#161616";
const MUTED = "#6f6f6f";
const FAINT = "#8d8d8d";
const BRAND = "#0f62fe";
const BORDER = "#e0e0e0";
const UP = "#24a148";
const DOWN = "#da1e28";
const EASE = [0.2, 0.7, 0.2, 1] as const;

const NATURAL = 860;

const SOURCES = [
  { label: "Google Ads", n: 60, pct: 36, mark: <GoogleMark size={11} /> },
  { label: "Meta", n: 45, pct: 27, mark: <MetaMark size={11} /> },
  { label: "Organic search", n: 30, pct: 18, mark: <Globe className="w-3 h-3" strokeWidth={2} style={{ color: MUTED }} aria-hidden /> },
  { label: "Resident referral", n: 17, pct: 10, mark: <Building2 className="w-3 h-3" strokeWidth={2} style={{ color: MUTED }} aria-hidden /> },
];

const MONTHLY = [9, 4, 2, 1, 1, 6, 5, 3, 2, 2, 3, 4];

const REVIEWS = [
  { source: "Google", count: 74 },
  { source: "Yelp", count: 26 },
  { source: "Reddit", count: 18 },
  { source: "Facebook", count: 10 },
];

const ENGINES = [
  { label: "ChatGPT", cited: 5, total: 12, mark: <ChatGPTMark size={11} /> },
  { label: "Claude", cited: 6, total: 12, mark: <ClaudeMark size={11} /> },
  { label: "Perplexity", cited: 8, total: 15, mark: <PerplexityMark size={11} /> },
  { label: "Gemini", cited: 0, total: 9, mark: <GeminiMark size={11} /> },
];

const COVERAGE = [
  { label: "Chatbot · pixel · leasing: live", color: UP },
  { label: "Reputation · AI visibility: live", color: UP },
  { label: "GA4, Search Console: indexing", color: BRAND },
  { label: "Zillow, Apartments.com: not wired", color: "#c6c6c6" },
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: FAINT }}>
      {children}
    </p>
  );
}

function Bar({ w, color, height, delay, on, radius = 999 }: { w: number; color: string; height: number; delay: number; on: boolean; radius?: number }) {
  return (
    <div style={{ flex: 1, height, backgroundColor: "#eef1f8", borderRadius: radius, overflow: "hidden" }}>
      <motion.div
        initial={false}
        animate={{ width: on ? `${w}%` : "0%" }}
        transition={{ duration: 0.6, ease: EASE, delay }}
        style={{ height: "100%", backgroundColor: color, borderRadius: radius }}
      />
    </div>
  );
}

function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className} style={{ border: `1px solid ${BORDER}`, borderRadius: 2, backgroundColor: "#FFFFFF", padding: "10px 12px" }}>
      {children}
    </div>
  );
}

export function ReportSnapshotMock() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const reduce = useReducedMotion();
  const on = reduce ? true : inView;
  const d = (t: number) => (reduce ? 0 : t);
  const rise = (delay: number) => ({
    initial: false as const,
    animate: { opacity: on ? 1 : 0, y: on ? 0 : 8 },
    transition: { duration: 0.4, ease: EASE, delay: d(delay) },
  });

  return (
    <div ref={ref}>
      <FitScale natural={NATURAL}>
        <ProductFrame url="app.leasestack.co/reports">
          <div style={{ padding: "14px 16px", backgroundColor: "#f7f8fa", textAlign: "left" }}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: INK, letterSpacing: "-0.015em" }}>
                  Marketing &amp; Performance Snapshot
                </p>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: MUTED, marginTop: 1 }}>
                  Student Central (Sample) · Berkeley, CA · trailing 28 days · first-touch attribution
                </p>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: FAINT, border: `1px solid ${BORDER}`, borderRadius: 2, padding: "2px 6px", backgroundColor: "#FFFFFF" }}>
                Sample data
              </span>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[
                { label: "New leads", to: 168, sub: "↑ vs prior", subColor: UP },
                { label: "Leases signed", to: 4, sub: "↑ from 2 prior", subColor: UP },
                { label: "Occupancy", to: 91, suffix: "%", sub: "3 on notice", subColor: DOWN },
                { label: "Rent roll", to: 168.4, prefix: "$", suffix: "K", decimals: 1, sub: "$1.9K avg / unit", subColor: FAINT },
              ].map((k) => (
                <motion.div key={k.label} {...rise(0.1)}>
                  <Cell>
                    <Label>{k.label}</Label>
                    <p className="mt-1" style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 500, color: INK, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                      {on ? <CountUp to={k.to} prefix={k.prefix ?? ""} suffix={k.suffix ?? ""} decimals={k.decimals ?? 0} locale duration={0.8} /> : "0"}
                    </p>
                    <p className="mt-0.5" style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: k.subColor }}>{k.sub}</p>
                  </Cell>
                </motion.div>
              ))}
            </div>

            {/* Middle: acquisition | momentum + renewals */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <motion.div {...rise(0.4)}>
                <Cell className="h-full">
                  <Label>Lead acquisition · first-touch</Label>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {SOURCES.map((s, i) => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 13, height: 13 }} aria-hidden>{s.mark}</span>
                        <span style={{ width: 96, fontFamily: "var(--font-sans)", fontSize: 10.5, color: INK, flexShrink: 0 }}>{s.label}</span>
                        <Bar w={s.pct * 2.4} color={BRAND} height={6} delay={d(0.5 + i * 0.06)} on={on} />
                        <span style={{ width: 48, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                          {s.n} · {s.pct}%
                        </span>
                      </div>
                    ))}
                    {["Zillow", "Apartments.com"].map((s) => (
                      <div key={s} className="flex items-center gap-2">
                        <span style={{ width: 13, height: 13, borderRadius: 2, backgroundColor: "#f0f1f4", flexShrink: 0 }} aria-hidden />
                        <span style={{ width: 96, fontFamily: "var(--font-sans)", fontSize: 10.5, color: FAINT, flexShrink: 0 }}>{s}</span>
                        <span className="ml-auto" style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>not tracked</span>
                      </div>
                    ))}
                  </div>
                </Cell>
              </motion.div>

              <div className="flex flex-col gap-2">
                <motion.div {...rise(0.55)}>
                  <Cell>
                    <div className="flex items-center justify-between">
                      <Label>Leasing momentum · 12 mo</Label>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>19 signed 180d · 87 active</span>
                    </div>
                    <div className="flex items-end gap-1 mt-2" style={{ height: 30 }}>
                      {MONTHLY.map((v, i) => (
                        <motion.span
                          key={i}
                          initial={false}
                          animate={{ height: on ? Math.max(3, (v / 9) * 30) : 3 }}
                          transition={{ duration: 0.5, ease: EASE, delay: d(0.65 + i * 0.035) }}
                          style={{ flex: 1, borderRadius: 1, backgroundColor: v === 9 ? BRAND : "#a6c8ff", display: "inline-block" }}
                        />
                      ))}
                    </div>
                  </Cell>
                </motion.div>
                <motion.div {...rise(0.75)}>
                  <Cell>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <Label>Renewals at risk</Label>
                        <p className="mt-1" style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 600, color: DOWN, fontVariantNumeric: "tabular-nums" }}>
                          {on ? <CountUp to={36.8} prefix="$" suffix="K" decimals={1} duration={0.7} /> : "$0"}
                        </p>
                      </div>
                      <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: MUTED, textAlign: "right", lineHeight: 1.5 }}>
                        19 expiring in 120 days<br />6 within 30 · 3 on notice
                      </p>
                    </div>
                  </Cell>
                </motion.div>
              </div>
            </div>

            {/* Bottom: reputation | AI visibility */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <motion.div {...rise(0.95)}>
                <Cell className="h-full">
                  <div className="flex items-center gap-1.5">
                    <Label>Online reputation</Label>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: INK }}>4.6</span>
                    <span style={{ fontSize: 9, color: BRAND, letterSpacing: 1 }}>★★★★★</span>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 9.5, color: FAINT }}>128 reviews</span>
                  </div>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {REVIEWS.map((r, i) => (
                      <div key={r.source} className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 13, height: 13 }} aria-hidden>
                          <SourceGlyph source={toMentionSource(r.source)} className="h-3 w-3" />
                        </span>
                        <span style={{ width: 62, fontFamily: "var(--font-sans)", fontSize: 10.5, color: INK, flexShrink: 0 }}>{r.source}</span>
                        <Bar w={(r.count / 74) * 100} color={BRAND} height={6} delay={d(1.05 + i * 0.05)} on={on} />
                        <span style={{ width: 20, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{r.count}</span>
                      </div>
                    ))}
                  </div>
                </Cell>
              </motion.div>
              <motion.div {...rise(1.15)}>
                <Cell className="h-full">
                  <div className="flex items-center justify-between">
                    <Label>AI search visibility</Label>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FFFFFF", backgroundColor: BRAND, borderRadius: 999, padding: "1px 7px" }}>
                      Exclusive
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {ENGINES.map((e, i) => (
                      <div key={e.label} className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 13, height: 13 }} aria-hidden>{e.mark}</span>
                        <span style={{ width: 62, fontFamily: "var(--font-sans)", fontSize: 10.5, color: INK, flexShrink: 0 }}>{e.label}</span>
                        <Bar w={(e.cited / e.total) * 100} color={BRAND} height={6} delay={d(1.25 + i * 0.05)} on={on} />
                        <span style={{ width: 30, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                          {e.cited}/{e.total}
                        </span>
                      </div>
                    ))}
                  </div>
                </Cell>
              </motion.div>
            </div>

            {/* Coverage footer */}
            <motion.div {...rise(1.5)} className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5" style={{ padding: "0 2px" }}>
              {COVERAGE.map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1.5">
                  <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: c.color, display: "inline-block" }} />
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 9.5, color: MUTED }}>{c.label}</span>
                </span>
              ))}
            </motion.div>
          </div>
        </ProductFrame>
      </FitScale>
    </div>
  );
}
