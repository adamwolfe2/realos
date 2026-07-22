import React from "react";
import { Eyebrow, WCard, ScoreChip, INK, MUTED, FAINT, BORDER, BRAND } from "./shell";

// Replica of the Leads pipeline (app/portal/leads/page.tsx) as a scored table:
// name, source, score, budget, next step, age. 42 active / 168 this month.

const LEADS = [
  { name: "Marcus T.", source: "Google Ads", score: 92, budget: "$1,850", next: "Call today", age: "2h" },
  { name: "Dana R.", source: "Meta", score: 84, budget: "$2,100", next: "Tour Sat 11am", age: "5h" },
  { name: "Jordan K.", source: "Organic", score: 78, budget: "$1,600", next: "Send floor plan", age: "1d" },
  { name: "Alex M.", source: "Referral", score: 71, budget: "$1,950", next: "Follow up", age: "1d" },
  { name: "Sam W.", source: "Google Ads", score: 66, budget: "$1,700", next: "Awaiting reply", age: "2d" },
  { name: "Lena P.", source: "Direct", score: 61, budget: "$2,200", next: "New", age: "3d" },
];

const COLS = ["Lead", "Source", "Score", "Budget", "Next step", "Age"];

export function ScreenLeads() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-end justify-between">
        <div>
          <Eyebrow>Pipeline</Eyebrow>
          <h1 className="mt-1" style={{ fontFamily: "var(--font-sans)", fontSize: 19, fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
            Leads
          </h1>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
          42 active · 168 this month
        </p>
      </div>

      <WCard className="mt-3 flex-1 min-h-0" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div
          className="grid items-center"
          style={{
            gridTemplateColumns: "1.4fr 1fr 0.6fr 0.8fr 1.2fr 0.5fr",
            padding: "9px 14px",
            borderBottom: `1px solid ${BORDER}`,
            backgroundColor: "#fbfcfe",
          }}
        >
          {COLS.map((c) => (
            <span key={c} style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: FAINT }}>
              {c}
            </span>
          ))}
        </div>
        <div className="flex-1">
          {LEADS.map((l, i) => (
            <div
              key={l.name}
              className="grid items-center"
              style={{
                gridTemplateColumns: "1.4fr 1fr 0.6fr 0.8fr 1.2fr 0.5fr",
                padding: "11px 14px",
                borderTop: i === 0 ? "none" : `1px solid ${BORDER}`,
              }}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: "#eef1f8", color: BRAND, fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600 }}
                >
                  {l.name.charAt(0)}
                </span>
                <span className="truncate" style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: INK }}>
                  {l.name}
                </span>
              </span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: MUTED }}>{l.source}</span>
              <span><ScoreChip score={l.score} /></span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: INK, fontVariantNumeric: "tabular-nums" }}>{l.budget}</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: INK }}>{l.next}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: FAINT }}>{l.age}</span>
            </div>
          ))}
        </div>
      </WCard>
    </div>
  );
}
