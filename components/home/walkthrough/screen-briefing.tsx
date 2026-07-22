import React from "react";
import { Sparkles, TrendingUp, TrendingDown, MessageSquare } from "lucide-react";
import { Eyebrow, WCard, Delta, INK, MUTED, FAINT, BORDER, BRAND } from "./shell";

// Replica of the AI Briefing screen (Adam's screenshot). Matches the portal's
// PageHeader chrome + insight rows with delta chips + the blue "THIS WEEK"
// actions panel + the live AEO toast. Seeded, consistent numbers.

const INSIGHTS = [
  {
    icon: TrendingUp,
    dir: "up" as const,
    delta: "14%",
    title: "Oak Grove is ahead of pace",
    body: "Google Ads is driving 40% of signed leases this cycle.",
  },
  {
    icon: TrendingDown,
    dir: "down" as const,
    delta: "32%",
    title: "Riverside is soft this week",
    body: "Tour bookings dropped. The 2-bed creative needs a refresh.",
  },
  {
    icon: MessageSquare,
    dir: "up" as const,
    delta: "12",
    title: "Chatbot captured 12 leads overnight",
    body: "Three flagged high-intent, ready for a morning call.",
  },
];

const ACTIONS = [
  "Shift $600 from Meta into Google Ads.",
  "Refresh the Riverside 2-bed creative.",
  "Approve the after-hours chatbot follow-up.",
];

export function ScreenBriefing() {
  return (
    <div className="h-full flex flex-col" style={{ position: "relative" }}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5" style={{ color: BRAND }} aria-hidden />
        <Eyebrow>AI briefing · Monday, 7:02 AM</Eyebrow>
      </div>
      <h1
        className="mt-1.5"
        style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}
      >
        Good morning, Sample Portfolio
      </h1>
      <p className="mt-1 inline-flex items-center gap-2" style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: MUTED }}>
        Leasing up <Delta value="14%" dir="up" /> week over week. Here is what moved.
      </p>

      <div className="grid grid-cols-3 gap-3 mt-4 flex-1 min-h-0">
        <div className="col-span-2">
          <WCard style={{ height: "100%", padding: 0, overflow: "hidden" }}>
            {INSIGHTS.map((it, i) => {
              const Icon = it.icon;
              return (
                <div
                  key={it.title}
                  className="flex items-start gap-3"
                  style={{ padding: "13px 15px", borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}
                >
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{ width: 28, height: 28, borderRadius: 2, backgroundColor: "rgba(15,98,254,0.08)", color: BRAND }}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Delta value={it.delta} dir={it.dir} />
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: INK }}>
                        {it.title}
                      </span>
                    </div>
                    <p className="mt-1" style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>
                      {it.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </WCard>
        </div>

        {/* Blue actions panel */}
        <div
          style={{
            backgroundColor: BRAND,
            borderRadius: 2,
            padding: 16,
            color: "#FFFFFF",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>
            This week · 3 actions
          </p>
          <ol className="mt-3 flex flex-col gap-3 flex-1">
            {ACTIONS.map((a, i) => (
              <li key={a} className="flex items-start gap-2.5">
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700 }}
                >
                  {i + 1}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, lineHeight: 1.4, color: "#FFFFFF" }}>{a}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Live AEO toast (bottom-left) */}
      <div
        className="inline-flex items-center gap-2"
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          backgroundColor: "#FFFFFF",
          border: `1px solid ${BORDER}`,
          borderRadius: 2,
          padding: "7px 11px",
          boxShadow: "0 8px 20px -10px rgba(22,22,22,0.2)",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: BRAND }}>LIVE</span>
        <span style={{ width: 1, height: 11, backgroundColor: BORDER }} />
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: MUTED }}>
          Perplexity quoted your amenities page
        </span>
      </div>
    </div>
  );
}
