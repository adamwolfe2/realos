"use client";

import React, { useEffect, useRef, useState } from "react";

type Turn =
  | { role: "bot"; text: string; typeMs?: number }
  | { role: "user"; text: string }
  | { role: "event"; text: string };

const SCRIPT: Turn[] = [
  { role: "bot",   text: "Hi — looking for student housing near campus? Ask me anything about the property." },
  { role: "user",  text: "what's the walk to campus?" },
  { role: "bot",   text: "Three-minute walk, two blocks from the main quad. Walk Score 99. Most residents roll out of bed and are in lecture before their coffee is cold." },
  { role: "user",  text: "is wifi included?" },
  { role: "bot",   text: "Yep. Wifi in every room, plus fiber ethernet and cable. Rent is all-inclusive." },
  { role: "bot",   text: "I can send you a floor-plan sheet and current openings. What's your email?" },
  { role: "user",  text: "student@university.edu" },
  { role: "event", text: "Lead captured · emailed floor-plan PDF · added to CRM" },
];

const ACCENT = "#2563EB";
const INK = "#141413";
const MUTED = "#87867f";
const BORDER = "#f0eee6";
const PARCHMENT = "#faf9f5";

export function ChatDemo() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVisibleCount(0);

    const run = async () => {
      for (let i = 0; i < SCRIPT.length; i++) {
        if (cancelled) return;
        const turn = SCRIPT[i];
        if (turn.role === "bot") {
          setTyping(true);
          await wait(800 + Math.min(turn.text.length * 18, 1400));
          if (cancelled) return;
          setTyping(false);
        } else {
          await wait(700);
          if (cancelled) return;
        }
        setVisibleCount(i + 1);
        await wait(380);
      }
      await wait(3200);
      if (!cancelled) setRestartKey((k) => k + 1);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [restartKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visibleCount, typing]);

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: `0 0 0 1px ${BORDER}, 0 20px 60px rgba(20,20,19,0.06)`,
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 md:px-6 py-3.5"
        style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              backgroundColor: ACCENT,
              color: "#ffffff",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            TC
          </span>
          <div>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: INK,
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              Property assistant
            </p>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: MUTED,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginTop: "2px",
              }}
            >
              Online · replies in seconds
            </p>
          </div>
        </div>
        <span
          className="inline-block"
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "#3a7d44",
            animation: "chatDot 1.8s ease-in-out infinite",
          }}
        />
      </div>

      <div
        ref={scrollRef}
        className="px-4 md:px-5 py-4 space-y-2.5"
        style={{ minHeight: "360px", maxHeight: "420px", overflowY: "auto" }}
      >
        {SCRIPT.slice(0, visibleCount).map((turn, i) => (
          <Bubble key={i} turn={turn} />
        ))}
        {typing && <TypingBubble />}
      </div>

      <div
        className="px-5 md:px-6 py-3 flex items-center gap-2"
        style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: "#ffffff" }}
      >
        <input
          aria-label="Type a message"
          placeholder="Ask about rooms, tours, pricing…"
          className="flex-1 outline-none"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13.5px",
            color: INK,
            background: "transparent",
            border: "none",
          }}
          readOnly
        />
        <button
          type="button"
          aria-label="Send"
          className="inline-flex items-center justify-center"
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            backgroundColor: ACCENT,
            color: "#ffffff",
            border: "none",
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7H12M12 7L8 3M12 7L8 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <style jsx>{`
        @keyframes chatDot {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  if (turn.role === "event") {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 my-2"
        style={{
          backgroundColor: "rgba(37,99,235,0.08)",
          border: `1px dashed ${ACCENT}`,
          borderRadius: "10px",
          animation: "bubbleIn 380ms ease",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="7" fill={ACCENT} />
          <path d="M3.5 7L6 9.5L10.5 4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.04em",
            color: ACCENT,
            fontWeight: 600,
          }}
        >
          {turn.text}
        </span>
        <style jsx>{`
          @keyframes bubbleIn {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  const isUser = turn.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[82%] px-3.5 py-2.5"
        style={{
          backgroundColor: isUser ? ACCENT : PARCHMENT,
          color: isUser ? "#ffffff" : INK,
          borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          fontFamily: "var(--font-sans)",
          fontSize: "13.5px",
          lineHeight: 1.5,
          animation: "bubbleIn 320ms ease",
          boxShadow: isUser ? "none" : `0 0 0 1px ${BORDER}`,
        }}
      >
        {turn.text}
        <style jsx>{`
          @keyframes bubbleIn {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div
        className="px-3.5 py-2.5 inline-flex items-center gap-1"
        style={{
          backgroundColor: PARCHMENT,
          borderRadius: "14px 14px 14px 4px",
          boxShadow: `0 0 0 1px ${BORDER}`,
        }}
      >
        <Dot delay={0} />
        <Dot delay={160} />
        <Dot delay={320} />
        <style jsx>{`
          @keyframes typingDot {
            0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
            40%           { opacity: 1;    transform: translateY(-2px); }
          }
        `}</style>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        backgroundColor: MUTED,
        animation: `typingDot 1.1s ease-in-out ${delay}ms infinite`,
      }}
    />
  );
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
