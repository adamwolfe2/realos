"use client";

import React, { useEffect, useState } from "react";
import {
  siPerplexity,
  siClaude,
  siGooglegemini,
  siReddit,
  siMeta,
  siGoogle,
} from "simple-icons";

type SiIcon = { path: string; title: string };

type Tool =
  | "perplexity"
  | "chatgpt"
  | "claude"
  | "gemini"
  | "reddit"
  | "meta"
  | "google"
  | "linkedin";

type Event = {
  kind: "lease" | "tour" | "lead" | "identify" | "ad" | "ai" | "report";
  text: string;
  where?: string;
  /** When set, the icon slot renders the brand glyph on its brand color
   *  instead of the generic kind icon. */
  tool?: Tool;
};

const EVENTS: Event[] = [
  { kind: "lease",    text: "Priya V. signed a lease",              where: "Oak Grove · 2BR" },
  { kind: "tour",     text: "Maya R. booked a tour",                where: "Westbrook Heights · Sat 10:30" },
  { kind: "lead",     text: "Daniel L. came from a Meta ad",        where: "intent score 88", tool: "meta" },
  { kind: "identify", text: "12 new identified visitors",           where: "last hour" },
  { kind: "ai",       text: "ChatGPT cited your amenities page",    where: "student housing query", tool: "chatgpt" },
  { kind: "ad",       text: "New Meta creative 'Fall Move-in' shipped", where: "48h turnaround", tool: "meta" },
  { kind: "lease",    text: "Alejandra S. signed a lease",          where: "Park & Pearl · 1BR" },
  { kind: "tour",     text: "Jordan K. booked a virtual tour",      where: "Sage at Greenpoint" },
  { kind: "identify", text: "Sofia P. identified from LinkedIn",    where: "viewed 3 floor plans", tool: "linkedin" },
  { kind: "ai",       text: "Perplexity quoted your amenities page", where: "furnished housing query", tool: "perplexity" },
  { kind: "ai",       text: "Claude cited your floor-plan page",     where: "two-bedroom Berkeley query", tool: "claude" },
  { kind: "ai",       text: "Gemini surfaced your tour-booking page", where: "student housing query", tool: "gemini" },
  { kind: "ai",       text: "New Reddit thread mentioned your property", where: "r/berkeley · 12 upvotes", tool: "reddit" },
  { kind: "report",   text: "Monday owner report delivered",        where: "168 leads · 31 tours · 4 leases" },
  { kind: "lead",     text: "Ravi K. captured by AI chatbot",       where: "asking about move-in dates" },
];

// OpenAI / ChatGPT mark — simple-icons doesn't ship it, so we embed the
// canonical "knot" path used in the OpenAI brand kit. Same render path
// as the other simple-icons glyphs so the visual rhythm stays consistent.
const SI_CHATGPT: SiIcon = {
  title: "ChatGPT",
  path: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.5093-2.6067-1.4997Z",
};

// LinkedIn — also not in simple-icons; embed the canonical mark path.
const SI_LINKEDIN: SiIcon = {
  title: "LinkedIn",
  path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
};

const TOOL_ICON: Record<Tool, SiIcon> = {
  perplexity: siPerplexity,
  chatgpt: SI_CHATGPT,
  claude: siClaude,
  gemini: siGooglegemini,
  reddit: siReddit,
  meta: siMeta,
  google: siGoogle,
  linkedin: SI_LINKEDIN,
};

const TOOL_COLOR: Record<Tool, string> = {
  perplexity: "#161616",
  chatgpt: "#10A37F",
  claude: "#C15F3C",
  gemini: "#4285F4",
  reddit: "#FF4500",
  meta: "#0866FF",
  google: "#4285F4",
  linkedin: "#0A66C2",
};

const ACCENT = "#0f62fe";
const INK = "#161616";
const MUTED = "#8d8d8d";
const BORDER = "#e0e0e0";

export function LiveTicker({
  variant = "fixed",
}: {
  variant?: "fixed" | "absolute";
}) {
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (dismissed) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % EVENTS.length);
    }, 4200);
    return () => clearInterval(id);
  }, [dismissed]);

  if (dismissed) return null;
  const event = EVENTS[idx];
  const positionClass = variant === "absolute" ? "absolute z-30" : "fixed z-40";

  return (
    <div
      aria-live="polite"
      className={`${positionClass} pointer-events-none`}
      style={{
        bottom: variant === "absolute" ? "16px" : "20px",
        left:   variant === "absolute" ? "16px" : "20px",
        maxWidth: "calc(100% - 32px)",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 520ms ease, transform 520ms ease",
      }}
    >
      <div
        className="pointer-events-auto flex items-start gap-3"
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "2px",
          boxShadow: `0 0 0 1px ${BORDER}`,
          padding: "12px 14px 12px 12px",
          minWidth: "280px",
          maxWidth: "360px",
        }}
      >
        <span
          className="flex-shrink-0 inline-flex items-center justify-center"
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "2px",
            backgroundColor: event.tool
              ? TOOL_COLOR[event.tool]
              : "rgba(15,98,254,0.10)",
            color: event.tool ? "#FFFFFF" : ACCENT,
          }}
        >
          {event.tool ? (
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              role="img"
              aria-label={TOOL_ICON[event.tool].title}
            >
              <path d={TOOL_ICON[event.tool].path} fill="currentColor" />
            </svg>
          ) : (
            <KindIcon kind={event.kind} />
          )}
        </span>

        <div className="flex-1 min-w-0" key={idx}>
          <div className="flex items-center gap-2">
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: ACCENT,
                display: "inline-block",
                animation: "tickerPulse 1.4s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: MUTED,
                fontWeight: 600,
              }}
            >
              Live · right now
            </span>
          </div>
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: INK,
              fontWeight: 500,
              lineHeight: 1.3,
              animation: "tickerIn 420ms ease",
            }}
          >
            {event.text}
          </p>
          {event.where ? (
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11.5px",
                color: MUTED,
                marginTop: "2px",
                lineHeight: 1.3,
                animation: "tickerIn 420ms ease",
              }}
            >
              {event.where}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Dismiss live ticker"
          onClick={() => setDismissed(true)}
          className="flex-shrink-0"
          style={{
            background: "transparent",
            border: "none",
            color: MUTED,
            cursor: "pointer",
            padding: "2px",
            lineHeight: 1,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <style jsx>{`
        @keyframes tickerPulse {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%      { transform: scale(1.4); opacity: 0.5; }
        }
        @keyframes tickerIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function KindIcon({ kind }: { kind: Event["kind"] }) {
  const p = { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (kind) {
    case "lease":    return <svg {...p}><path d="M2 7L7 3L12 7V12H8V9H6V12H2V7Z" /></svg>;
    case "tour":     return <svg {...p}><rect x="2" y="3" width="10" height="9" rx="1.5"/><path d="M2 6h10M5 2v2M9 2v2"/></svg>;
    case "lead":     return <svg {...p}><circle cx="7" cy="5" r="2.4"/><path d="M2.5 12c.5-2.2 2.4-3.8 4.5-3.8s4 1.6 4.5 3.8"/></svg>;
    case "identify": return <svg {...p}><circle cx="7" cy="7" r="4"/><circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none"/></svg>;
    case "ad":       return <svg {...p}><path d="M2 5H5L9 2V12L5 9H2V5Z" /></svg>;
    case "ai":       return <svg {...p}><path d="M7 1.5L8.4 5L12 6L8.4 7L7 10.5L5.6 7L2 6L5.6 5L7 1.5Z" fill="currentColor" stroke="none"/></svg>;
    case "report":   return <svg {...p}><path d="M3 11V3h8v8H3Zm2-4h4M5 9h4M5 5h3"/></svg>;
  }
}
