import React from "react";
import { Eyebrow, WCard, Delta, INK, MUTED, FAINT, BORDER, BRAND } from "./shell";

// Replica of the operator Dashboard (app/portal/page.tsx). KPI row uses the
// real labels (Leads (28d), Ad spend (28d), Tours scheduled (28d), Organic
// visitors (28d), Active properties) + the Conversion funnel (Last 28 days)
// and Lead sources. Numbers are the canonical funnel: 12,480 → 168 → 31 → 11 → 4.

const KPIS = [
  { label: "Leads (28d)", value: "168", delta: { value: "14%", dir: "up" as const } },
  { label: "Ad spend (28d)", value: "$18,240", delta: { value: "6%", dir: "down" as const } },
  { label: "Tours scheduled (28d)", value: "31", delta: { value: "8%", dir: "up" as const } },
  { label: "Organic visitors (28d)", value: "12,480", delta: { value: "11%", dir: "up" as const } },
  { label: "Active properties", value: "4" },
];

const FUNNEL = [
  { label: "Website visitors", value: 12480, w: 100 },
  { label: "Leads", value: 168, w: 62 },
  { label: "Tours", value: 31, w: 38 },
  { label: "Applications", value: 11, w: 22 },
  { label: "Signed leases", value: 4, w: 12 },
];

// Share of the 168 leads (28d) by source. Percentages sum to 100 — no
// contradiction with the 4 signed leases in the funnel above.
const SOURCES = [
  { label: "Google Ads", share: 36, color: "#0043ce" },
  { label: "Meta", share: 27, color: "#0f62fe" },
  { label: "Organic search", share: 18, color: "#4589ff" },
  { label: "Resident referral", share: 10, color: "#78a9ff" },
  { label: "Direct / brand", share: 9, color: "#a6c8ff" },
];

export function ScreenDashboard() {
  return (
    <div className="h-full flex flex-col">
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
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>
              {k.label}
            </p>
            <p className="mt-1.5" style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 500, color: INK, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
              {k.value}
            </p>
            {k.delta ? (
              <div className="mt-1.5">
                <Delta value={k.delta.value} dir={k.delta.dir} />
              </div>
            ) : (
              <div className="mt-1.5" style={{ height: 18 }} />
            )}
          </WCard>
        ))}
      </div>

      {/* Funnel + sources */}
      <div className="grid grid-cols-5 gap-3 mt-3 flex-1 min-h-0">
        <WCard className="col-span-3" style={{ padding: 15, display: "flex", flexDirection: "column" }}>
          <Eyebrow>Last 28 days</Eyebrow>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: INK, marginTop: 3 }}>Conversion funnel</p>
          <div className="flex flex-col gap-2.5 mt-3 flex-1 justify-center">
            {FUNNEL.map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <span style={{ width: 108, fontFamily: "var(--font-sans)", fontSize: 12, color: MUTED, flexShrink: 0 }}>{f.label}</span>
                <div style={{ flex: 1, height: 18, backgroundColor: "#eef1f8", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${f.w}%`, height: "100%", backgroundColor: BRAND, borderRadius: 2 }} />
                </div>
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
            {SOURCES.map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: INK }}>{s.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{s.share}%</span>
                </div>
                <div className="mt-1" style={{ height: 6, backgroundColor: "#eef1f8", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${s.share}%`, height: "100%", backgroundColor: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </WCard>
      </div>
    </div>
  );
}
