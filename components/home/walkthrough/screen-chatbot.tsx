"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { MessageSquare, CalendarCheck } from "lucide-react";
import { Eyebrow, WCard, INK, MUTED, FAINT, BORDER, BRAND } from "./shell";

// Replica of Conversations / Chatbot. Landing v3 animation pass (Adam
// 2026-07-23): the conversation PLAYS in real time — the 2:14 AM visitor
// message lands, the assistant shows a typing indicator, replies, books the
// tour, and the green "Lead captured" banner pops at the end. End to end,
// exactly how the product works overnight. Reduced-motion shows the full
// transcript immediately.

const THREADS = [
  { name: "Marcus T.", preview: "Is the 2-bed still available?", time: "2:14 AM", active: true, flag: true },
  { name: "Dana R.", preview: "Can I tour this weekend?", time: "12:41 AM", active: false, flag: true },
  { name: "Jordan K.", preview: "What's the pet policy?", time: "11:58 PM", active: false, flag: false },
];

const MESSAGES = [
  { from: "visitor" as const, text: "Is the 2-bed at Oak Grove still available for June?", time: "2:14 AM" },
  { from: "bot" as const, text: "It is. The June 2-bed is $1,850 with parking included. Want me to hold a tour time?", time: "2:14 AM" },
  { from: "visitor" as const, text: "Saturday morning works.", time: "2:15 AM" },
  { from: "bot" as const, text: "Booked you for Saturday 11:00 AM. I sent the floor plan and confirmation to your email.", time: "2:15 AM" },
];

// step timeline: 1..4 = messages visible; typing shows before each bot msg.
const STEP_AT_MS = [400, 1900, 2900, 4400];
const TYPING_LEAD_MS = 900; // typing dots run this long before each bot msg
const BANNER_AT_MS = 5200;

const EASE = [0.2, 0.7, 0.2, 1] as const;

function TypingDots() {
  return (
    <div className="self-end" style={{ maxWidth: "82%" }}>
      <div
        className="flex items-center gap-1"
        style={{ padding: "9px 12px", borderRadius: 8, borderBottomRightRadius: 2, backgroundColor: BRAND }}
        aria-label="Assistant is typing"
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
            style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.9)", display: "inline-block" }}
          />
        ))}
      </div>
    </div>
  );
}

export function ScreenChatbot() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();

  const [visible, setVisible] = useState(reduce ? MESSAGES.length : 0);
  const [typing, setTyping] = useState(false);
  const [banner, setBanner] = useState(!!reduce);

  useEffect(() => {
    if (reduce || !inView) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    MESSAGES.forEach((m, i) => {
      if (m.from === "bot") {
        timers.push(setTimeout(() => setTyping(true), STEP_AT_MS[i] - TYPING_LEAD_MS));
      }
      timers.push(
        setTimeout(() => {
          setTyping(false);
          setVisible(i + 1);
        }, STEP_AT_MS[i]),
      );
    });
    timers.push(setTimeout(() => setBanner(true), BANNER_AT_MS));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduce]);

  return (
    <div ref={ref} className="h-full flex flex-col">
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
            <motion.div
              key={t.name}
              initial={false}
              animate={{ opacity: inView || reduce ? 1 : 0, x: inView || reduce ? 0 : -10 }}
              transition={{ duration: 0.35, ease: EASE, delay: reduce ? 0 : i * 0.1 }}
              style={{
                padding: "11px 13px",
                borderTop: i === 0 ? "none" : `1px solid ${BORDER}`,
                backgroundColor: t.active ? "rgba(15,98,254,0.06)" : "transparent",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: INK }}>{t.name}</span>
                  {t.flag ? (
                    <motion.span
                      animate={t.active && !banner && !reduce ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
                      transition={{ duration: 1.4, repeat: t.active && !banner && !reduce ? Infinity : 0 }}
                      style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: BRAND, flexShrink: 0, display: "inline-block" }}
                    />
                  ) : null}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: FAINT }}>{t.time}</span>
              </div>
              <p className="mt-0.5 truncate" style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: MUTED }}>{t.preview}</p>
            </motion.div>
          ))}
        </WCard>

        {/* Transcript — plays live. */}
        <WCard className="col-span-3" style={{ padding: 14, display: "flex", flexDirection: "column" }}>
          <div className="flex items-center justify-between pb-2.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center" style={{ width: 24, height: 24, borderRadius: 2, backgroundColor: "rgba(15,98,254,0.10)", color: BRAND }}>
                <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden />
              </span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: INK }}>Marcus T. · Oak Grove</span>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: FAINT, fontVariantNumeric: "tabular-nums" }}>
              2:14 AM · office closed
            </span>
          </div>

          <div className="flex flex-col gap-2 mt-3 flex-1 justify-end" style={{ minHeight: 0 }}>
            {MESSAGES.slice(0, visible).map((m, i) => (
              <motion.div
                key={i}
                initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className={m.from === "bot" ? "self-end" : "self-start"}
                style={{ maxWidth: "82%" }}
              >
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
                <p
                  className={m.from === "bot" ? "text-right" : ""}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: FAINT, marginTop: 2 }}
                >
                  {m.from === "bot" ? "LeaseStack AI" : "Visitor"} · {m.time}
                </p>
              </motion.div>
            ))}
            {typing ? <TypingDots /> : null}
          </div>

          {/* Lead captured — pops once the tour is booked. */}
          <div style={{ minHeight: 38 }} className="mt-2">
            <AnimatePresence>
              {banner ? (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 340, damping: 22 }}
                  className="flex items-center gap-2"
                  style={{ padding: "8px 11px", borderRadius: 2, backgroundColor: "rgba(36,161,72,0.08)", border: "1px solid rgba(36,161,72,0.25)" }}
                >
                  <motion.span
                    initial={reduce ? false : { scale: 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.1 }}
                    style={{ display: "inline-flex" }}
                  >
                    <CalendarCheck className="w-3.5 h-3.5" style={{ color: "#24a148" }} aria-hidden />
                  </motion.span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "#1a7a38" }}>
                    Lead captured · Tour booked Sat 11:00 AM
                  </span>
                  <span className="ml-auto" style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1a7a38" }}>
                    Synced to pipeline
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </WCard>
      </div>
    </div>
  );
}
