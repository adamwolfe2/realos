import React from "react";
import { MessageSquare, CalendarCheck } from "lucide-react";
import { Eyebrow, WCard, INK, MUTED, FAINT, BORDER, BRAND } from "./shell";

// Replica of Conversations / Chatbot (app/portal/conversations/page.tsx): the
// after-hours AI assistant. Transcript view with a captured-lead outcome.
// 6 flagged, 12 captured overnight (consistent with the briefing).

const THREADS = [
  { name: "Marcus T.", preview: "Is the 2-bed still available?", time: "2:14 AM", active: true, flag: true },
  { name: "Dana R.", preview: "Can I tour this weekend?", time: "12:41 AM", active: false, flag: true },
  { name: "Jordan K.", preview: "What's the pet policy?", time: "11:58 PM", active: false, flag: false },
];

const MESSAGES = [
  { from: "visitor" as const, text: "Is the 2-bed at Oak Grove still available for June?" },
  { from: "bot" as const, text: "It is. The June 2-bed is $1,850 with parking included. Want me to hold a tour time?" },
  { from: "visitor" as const, text: "Saturday morning works." },
  { from: "bot" as const, text: "Booked you for Saturday 11:00 AM. I sent the floor plan and confirmation to your email." },
];

export function ScreenChatbot() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-end justify-between">
        <div>
          <Eyebrow>After hours</Eyebrow>
          <h1 className="mt-1" style={{ fontFamily: "var(--font-sans)", fontSize: 19, fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
            Conversations
          </h1>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
          6 flagged · 12 captured overnight
        </p>
      </div>

      <div className="grid grid-cols-5 gap-3 mt-3 flex-1 min-h-0">
        {/* Thread list */}
        <WCard className="col-span-2" style={{ padding: 0, overflow: "hidden" }}>
          {THREADS.map((t, i) => (
            <div
              key={t.name}
              style={{
                padding: "11px 13px",
                borderTop: i === 0 ? "none" : `1px solid ${BORDER}`,
                backgroundColor: t.active ? "rgba(15,98,254,0.06)" : "transparent",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: INK }}>{t.name}</span>
                  {t.flag ? <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: BRAND, flexShrink: 0 }} /> : null}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: FAINT }}>{t.time}</span>
              </div>
              <p className="mt-0.5 truncate" style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: MUTED }}>{t.preview}</p>
            </div>
          ))}
        </WCard>

        {/* Transcript */}
        <WCard className="col-span-3" style={{ padding: 14, display: "flex", flexDirection: "column" }}>
          <div className="flex items-center gap-2 pb-2.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <span className="inline-flex items-center justify-center" style={{ width: 24, height: 24, borderRadius: 2, backgroundColor: "rgba(15,98,254,0.10)", color: BRAND }}>
              <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden />
            </span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: INK }}>Marcus T. · Oak Grove</span>
          </div>
          <div className="flex flex-col gap-2 mt-3 flex-1 justify-center">
            {MESSAGES.map((m, i) => (
              <div key={i} className={m.from === "bot" ? "self-end" : "self-start"} style={{ maxWidth: "82%" }}>
                <div
                  style={{
                    padding: "7px 11px",
                    borderRadius: 8,
                    fontFamily: "var(--font-sans)",
                    fontSize: 12,
                    lineHeight: 1.4,
                    backgroundColor: m.from === "bot" ? BRAND : "#eef1f8",
                    color: m.from === "bot" ? "#FFFFFF" : INK,
                    borderBottomRightRadius: m.from === "bot" ? 2 : 8,
                    borderBottomLeftRadius: m.from === "bot" ? 8 : 2,
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div
            className="flex items-center gap-2 mt-3"
            style={{ padding: "8px 11px", borderRadius: 2, backgroundColor: "rgba(36,161,72,0.08)" }}
          >
            <CalendarCheck className="w-3.5 h-3.5" style={{ color: "#24a148" }} aria-hidden />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "#1a7a38" }}>
              Lead captured · Tour booked Sat 11:00 AM
            </span>
          </div>
        </WCard>
      </div>
    </div>
  );
}
