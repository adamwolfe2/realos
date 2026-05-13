"use client";

import React, { useEffect, useState } from "react";
import { ChatGPTMark, PerplexityMark, ClaudeMark, GeminiMark, GoogleMark } from "./brand-logos";

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const BORDER = "#E2E8F0";
const PARCHMENT = "#F1F5F9";

const ANSWER =
  "A private student-housing property two blocks from the main campus quad. Fully furnished units with wifi, fiber ethernet, and daily housekeeping included. Walk Score 99.";

const CITATIONS = [
  { rank: 1, domain: "property-site.com",   page: "/amenities",    chosen: true  },
  { rank: 2, domain: "property-site.com",   page: "/location",     chosen: true  },
  { rank: 3, domain: "reddit.com",          page: "/r/campus",      chosen: false },
  { rank: 4, domain: "university.edu",      page: "/housing",       chosen: false },
];

const QUERIES = [
  "best student housing near campus",
  "off-campus apartments with wifi included",
  "furnished student apartments walking distance to campus",
];

export function SeoAnswer() {
  const [queryIdx, setQueryIdx] = useState(0);
  const [typedQuery, setTypedQuery] = useState("");
  const [phase, setPhase] = useState<"typing" | "thinking" | "answering" | "done">("typing");
  const [answeredChars, setAnsweredChars] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const query = QUERIES[queryIdx];

    const run = async () => {
      setTypedQuery("");
      setAnsweredChars(0);
      setPhase("typing");

      for (let i = 1; i <= query.length; i++) {
        if (cancelled) return;
        setTypedQuery(query.slice(0, i));
        await wait(38);
      }

      setPhase("thinking");
      await wait(900);
      if (cancelled) return;

      setPhase("answering");
      for (let i = 1; i <= ANSWER.length; i++) {
        if (cancelled) return;
        setAnsweredChars(i);
        await wait(12);
      }

      setPhase("done");
      await wait(3400);
      if (cancelled) return;
      setQueryIdx((q) => (q + 1) % QUERIES.length);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [queryIdx]);

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: `0 0 0 1px ${BORDER}, 0 20px 60px rgba(30, 42, 58,0.06)`,
        overflow: "hidden",
      }}
    >
      <div
        className="px-5 md:px-6 py-3 flex items-center justify-between gap-2"
        style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              boxShadow: `0 0 0 1px ${BORDER}`,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M4 0L4.9 3.1L8 4L4.9 4.9L4 8L3.1 4.9L0 4L3.1 3.1L4 0Z" fill={ACCENT} />
            </svg>
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: MUTED,
              fontWeight: 600,
            }}
          >
            How you show up on AI
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <ChatGPTMark size={14} />
          <PerplexityMark size={14} />
          <ClaudeMark size={14} />
          <GeminiMark size={14} />
          <GoogleMark size={14} />
        </div>
      </div>

      <div
        className="px-5 md:px-6 py-3 flex items-center gap-2"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="5" stroke={MUTED} strokeWidth="1.4" />
          <path d="M10 10L13 13" stroke={MUTED} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13.5px",
            color: INK,
          }}
        >
          {typedQuery}
          <span
            style={{
              display: "inline-block",
              width: "1px",
              height: "14px",
              backgroundColor: INK,
              marginLeft: "2px",
              verticalAlign: "-2px",
              animation: "seoCaret 1s step-start infinite",
              opacity: phase === "typing" ? 1 : 0,
            }}
          />
        </span>
      </div>

      <div className="px-5 md:px-6 py-5">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "6px",
              backgroundColor: ACCENT,
              color: "#ffffff",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1V6L9 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: ACCENT,
              fontWeight: 600,
            }}
          >
            AI answer
          </span>
          {phase === "thinking" && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: MUTED,
                letterSpacing: "0.06em",
              }}
            >
              searching…
            </span>
          )}
        </div>

        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14.5px",
            color: INK,
            lineHeight: 1.55,
            minHeight: "96px",
          }}
        >
          {renderAnswerWithHighlights(ANSWER.slice(0, answeredChars))}
          {phase === "answering" && (
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "14px",
                backgroundColor: ACCENT,
                marginLeft: "2px",
                verticalAlign: "-2px",
                animation: "seoCaret 0.8s step-start infinite",
              }}
            />
          )}
        </p>

        {phase === "done" && (
          <div
            className="mt-4 pt-4"
            style={{
              borderTop: `1px dashed ${BORDER}`,
              animation: "seoFade 380ms ease",
            }}
          >
            <p
              className="mb-2"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: MUTED,
                fontWeight: 500,
              }}
            >
              Citations
            </p>
            <ul className="space-y-1.5">
              {CITATIONS.map((c) => (
                <li
                  key={c.rank}
                  className="flex items-center gap-2"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11.5px",
                    color: c.chosen ? ACCENT : MUTED,
                    fontWeight: c.chosen ? 600 : 500,
                  }}
                >
                  <span
                    style={{
                      width: "18px",
                      display: "inline-block",
                      textAlign: "right",
                      opacity: 0.75,
                    }}
                  >
                    [{c.rank}]
                  </span>
                  <span>{c.domain}</span>
                  <span style={{ color: c.chosen ? ACCENT : MUTED, opacity: 0.7 }}>{c.page}</span>
                  {c.chosen && (
                    <span
                      style={{
                        fontSize: "9px",
                        padding: "1px 6px",
                        backgroundColor: "rgba(37,99,235,0.12)",
                        borderRadius: "4px",
                        letterSpacing: "0.08em",
                      }}
                    >
                      CHOSEN
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div
        className="px-5 md:px-6 py-3 flex items-center justify-between gap-3"
        style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: MUTED,
            fontWeight: 500,
          }}
        >
          Your pages are the answer when prospects ask the AI
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: MUTED,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: "4px",
            backgroundColor: "rgba(135,134,127,0.12)",
            flexShrink: 0,
          }}
        >
          Illustrative
        </span>
      </div>

      <style jsx>{`
        @keyframes seoCaret {
          0%, 50%  { opacity: 1; }
          51%, 100%{ opacity: 0; }
        }
        @keyframes seoFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function renderAnswerWithHighlights(text: string) {
  // Highlight the key positioning phrase so readers' eyes find it fast.
  const phrases = ["student-housing property", "Walk Score 99"];
  const pattern = new RegExp(`(${phrases.map((p) => escapeRegExp(p)).join("|")})`, "g");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, idx)}</span>);
    }
    parts.push(
      <mark
        key={key++}
        style={{
          backgroundColor: "rgba(37,99,235,0.16)",
          color: ACCENT,
          padding: "0 2px",
          borderRadius: "3px",
          fontWeight: 600,
        }}
      >
        {match[0]}
      </mark>,
    );
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }
  return parts;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
