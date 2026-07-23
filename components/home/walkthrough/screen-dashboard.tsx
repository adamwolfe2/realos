"use client";

import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { CalendarCheck, Fingerprint, FileSignature, Search, UserPlus, Globe } from "lucide-react";
import { Eyebrow, WCard, Delta, INK, MUTED, FAINT, BORDER, BRAND, UP } from "./shell";
import { CountUp } from "../count-up";
import { GoogleMark, MetaMark } from "@/components/platform/artifacts/brand-logos";

// Replica of the operator Dashboard (app/portal/page.tsx). KPI row uses the
// real labels (Leads (28d), Ad spend (28d), Tours scheduled (28d), Organic
// visitors (28d), Active properties) + the Conversion funnel (Last 28 days),
// Lead sources, and a recent-activity strip. Numbers are the canonical demo
// funnel: 12,480 → 168 → 31 → 11 → 4. Landing v3: numbers count up once and
// the bars grow with a stagger on first view — a dashboard waking up, not a
// static slide. Reduced-motion renders the final state immediately.

// Labels are single-line by design (Adam 2026-07-23: wrapped labels pushed
// values to different heights). Every tile shares an identical row skeleton:
// 14px label line → value → 16px trend line.
const KPIS: Array<{
  label: string;
  to: number;
  prefix?: string;
  delta?: { value: string; dir: "up" | "down" };
}> = [
  { label: "Leads (28d)", to: 168, delta: { value: "14%", dir: "up" } },
  { label: "Ad spend (28d)", to: 18240, prefix: "$", delta: { value: "6%", dir: "down" } },
  { label: "Tours (28d)", to: 31, delta: { value: "8%", dir: "up" } },
  { label: "Organic (28d)", to: 12480, delta: { value: "11%", dir: "up" } },
  { label: "Properties", to: 4 },
];

const FUNNEL = [
  { label: "Website visitors", value: 12480, w: 100 },
  { label: "Leads", value: 168, w: 62 },
  { label: "Tours", value: 31, w: 38 },
  { label: "Applications", value: 11, w: 22 },
  { label: "Signed leases", value: 4, w: 12 },
];

// Share of the 168 leads (28d) by source. Percentages sum to 100 — no
// contradiction with the 4 signed leases in the funnel above. Each source
// carries its mark (brand SVG or lucide icon) per Adam 2026-07-23.
const SOURCES: Array<{
  label: string;
  share: number;
  color: string;
  mark: React.ReactNode;
}> = [
  { label: "Google Ads", share: 36, color: "#0043ce", mark: <GoogleMark size={12} /> },
  { label: "Meta", share: 27, color: "#0f62fe", mark: <MetaMark size={12} /> },
  { label: "Organic search", share: 18, color: "#4589ff", mark: <Search className="w-3 h-3" strokeWidth={2} style={{ color: "#6f6f6f" }} aria-hidden /> },
  { label: "Resident referral", share: 10, color: "#78a9ff", mark: <UserPlus className="w-3 h-3" strokeWidth={2} style={{ color: "#6f6f6f" }} aria-hidden /> },
  { label: "Direct / brand", share: 9, color: "#a6c8ff", mark: <Globe className="w-3 h-3" strokeWidth={2} style={{ color: "#6f6f6f" }} aria-hidden /> },
];

const ACTIVITY = [
  { icon: CalendarCheck, color: UP, text: "Tour booked overnight · Marcus T.", meta: "2:14 AM" },
  { icon: Fingerprint, color: BRAND, text: "Visitor identified · Taylor B.", meta: "6m ago" },
  { icon: FileSignature, color: INK, text: "Lease signed · Google Ads · $68 CPL", meta: "Yesterday" },
];

// A horizontal bar that grows to its width once on first view.
function GrowBar({
  w,
  color,
  height,
  radius = 2,
  delay = 0,
  grow,
}: {
  w: number;
  color: string;
  height: number;
  radius?: number;
  delay?: number;
  grow: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        height,
        backgroundColor: "#eef1f8",
        borderRadius: radius,
        overflow: "hidden",
      }}
    >
      <motion.div
        initial={false}
        animate={{ width: grow ? `${w}%` : "0%" }}
        transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1], delay }}
        style={{ height: "100%", backgroundColor: color, borderRadius: radius }}
      />
    </div>
  );
}

export function ScreenDashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const grow = reduce ? true : inView;

  return (
    <div ref={ref} className="h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <Eyebrow>At a glance · last 28 days</Eyebrow>
          <h1 className="mt-1" style={{ fontFamily: "var(--font-sans)", fontSize: 19, fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
            Dashboard
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-1" style={{ border: `1px solid ${BORDER}`, borderRadius: 2, padding: 2 }}>
          {["7d", "28d", "90d"].map((t) => (
            <span
              key={t}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: 2,
                color: t === "28d" ? "#FFFFFF" : "#8d8d8d",
                backgroundColor: t === "28d" ? BRAND : "transparent",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-5 gap-2.5 mt-3">
        {KPIS.map((k) => (
          <WCard key={k.label} style={{ padding: "11px 12px" }}>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: FAINT,
                // One line, always — no wrap-driven height drift between tiles.
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: "14px",
                height: 14,
              }}
            >
              {k.label}
            </p>
            <p className="mt-1.5" style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 500, color: INK, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: "28px" }}>
              <CountUp to={k.to} prefix={k.prefix ?? ""} locale duration={0.8} />
            </p>
            <div className="mt-1.5" style={{ height: 16 }}>
              {k.delta ? <Delta value={k.delta.value} dir={k.delta.dir} /> : null}
            </div>
          </WCard>
        ))}
      </div>

      {/* Funnel + sources */}
      <div className="grid grid-cols-5 gap-3 mt-3 flex-1 min-h-0">
        <WCard className="col-span-3" style={{ padding: 15, display: "flex", flexDirection: "column" }}>
          <Eyebrow>Last 28 days</Eyebrow>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: INK, marginTop: 3 }}>Conversion funnel</p>
          <div className="flex flex-col gap-2.5 mt-3 flex-1 justify-center">
            {FUNNEL.map((f, i) => (
              <div key={f.label} className="flex items-center gap-3">
                <span style={{ width: 108, fontFamily: "var(--font-sans)", fontSize: 12, color: MUTED, flexShrink: 0 }}>{f.label}</span>
                <GrowBar w={f.w} color={BRAND} height={18} delay={reduce ? 0 : 0.1 + i * 0.08} grow={grow} />
                <span style={{ width: 54, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {f.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </WCard>

        <WCard className="col-span-2" style={{ padding: 15, display: "flex", flexDirection: "column" }}>
          <Eyebrow>Lead sources · last 28 days</Eyebrow>
          <div className="flex flex-col gap-2.5 mt-3 flex-1 justify-center">
            {SOURCES.map((s, i) => (
              <div key={s.label}>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 14, height: 14 }} aria-hidden>
                      {s.mark}
                    </span>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: INK }}>{s.label}</span>
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{s.share}%</span>
                </div>
                <div className="mt-1 flex">
                  <GrowBar w={s.share} color={s.color} height={6} radius={999} delay={reduce ? 0 : 0.2 + i * 0.06} grow={grow} />
                </div>
              </div>
            ))}
          </div>
        </WCard>
      </div>

      {/* Recent activity strip — the system doing the work while you read. */}
      <WCard className="mt-3" style={{ padding: 0, overflow: "hidden" }}>
        <div className="grid grid-cols-3">
          {ACTIVITY.map((a, i) => {
            const Icon = a.icon;
            return (
              <motion.div
                key={a.text}
                className="flex items-center gap-2 min-w-0"
                initial={false}
                animate={{ opacity: grow ? 1 : 0, y: grow ? 0 : 6 }}
                transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1], delay: reduce ? 0 : 0.5 + i * 0.12 }}
                style={{ padding: "9px 13px", borderLeft: i === 0 ? "none" : `1px solid ${BORDER}` }}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} style={{ color: a.color }} aria-hidden />
                <span className="truncate" style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, fontWeight: 500, color: INK }}>
                  {a.text}
                </span>
                <span className="ml-auto flex-shrink-0" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: FAINT, fontVariantNumeric: "tabular-nums" }}>
                  {a.meta}
                </span>
              </motion.div>
            );
          })}
        </div>
      </WCard>
    </div>
  );
}
