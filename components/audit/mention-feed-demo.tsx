"use client";

import * as React from "react";
import { Star, MessageSquare, TriangleAlert } from "lucide-react";
import { GoogleMark } from "@/components/platform/artifacts/brand-logos";

// ---------------------------------------------------------------------------
// MentionFeedDemo — hero animation for /reputation-report, in the AiAnswerDemo
// chrome (app-window frame, staged reveal, reduced-motion static fallback).
//
// A fixed sample feed of Google/Yelp/Reddit mentions rises in one card at a
// time, holds, then loops. One card is a flagged negative review sitting
// unanswered — the "renters read all of it" point of the page. Sample data
// only; the real report pulls live mentions.
//
// No Yelp/Reddit brand SVGs exist in the codebase yet, so those two sources
// use a colored Lucide-icon badge (Star / MessageSquare) instead of adding
// new logo assets for a marketing mock. Google already has a mark
// (brand-logos.tsx) so that one's reused.
// ---------------------------------------------------------------------------

type Source = "google" | "yelp" | "reddit";

interface Mention {
  source: Source;
  author: string;
  text: string;
  flagged?: boolean;
}

const MENTIONS: Mention[] = [
  { source: "google", author: "Jasmine R.", text: "Toured last week, the leasing office actually called me back same day." },
  { source: "reddit", author: "u/berkeleyrenter24", text: "anyone know if [property] is worth the price? floor plans look nice" },
  { source: "yelp", author: "Marcus T.", text: "Maintenance never fixed my AC after 3 requests. Would not renew.", flagged: true },
  { source: "google", author: "Priya K.", text: "Clean building, good parking, a little noisy on weekends." },
  { source: "reddit", author: "u/gradstudent_eastbay", text: "moved in last month, quiet so far, staff has been helpful" },
];

const HOLD_MS = 1400;
const RESET_HOLD_MS = 2400;

const SOURCE_META: Record<Source, { label: string; badge: React.ReactNode; color: string }> = {
  google: { label: "Google", badge: <GoogleMark size={13} />, color: "#4285F4" },
  yelp: {
    label: "Yelp",
    badge: (
      <span
        className="grid h-[13px] w-[13px] place-items-center rounded-full"
        style={{ backgroundColor: "#d32323" }}
      >
        <Star className="h-[8px] w-[8px]" style={{ color: "#fff" }} fill="#fff" />
      </span>
    ),
    color: "#d32323",
  },
  reddit: {
    label: "Reddit",
    badge: (
      <span
        className="grid h-[13px] w-[13px] place-items-center rounded-full"
        style={{ backgroundColor: "#FF4500" }}
      >
        <MessageSquare className="h-[8px] w-[8px]" style={{ color: "#fff" }} fill="#fff" />
      </span>
    ),
    color: "#FF4500",
  },
};

export function MentionFeedDemo() {
  const [visible, setVisible] = React.useState(0);
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  React.useEffect(() => {
    if (reduced) {
      setVisible(MENTIONS.length);
      return;
    }
    const t = setTimeout(
      () => {
        if (visible < MENTIONS.length) {
          setVisible((n) => n + 1);
        } else {
          setVisible(0);
        }
      },
      visible < MENTIONS.length ? HOLD_MS : RESET_HOLD_MS,
    );
    return () => clearTimeout(t);
  }, [visible, reduced]);

  return (
    <div className="mfd-root">
      <style>{`
        .mfd-root { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; background: #fff;
          box-shadow: 0 2px 4px rgba(15,23,42,.05), 0 16px 40px rgba(15,23,42,.09); }
        @keyframes mfd-row { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes mfd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        .mfd-row-in { animation: mfd-row .42s cubic-bezier(.2,.8,.2,1) both; }
        .mfd-live { animation: mfd-pulse 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mfd-row-in { animation: none; opacity: 1; transform: none; }
          .mfd-live { animation: none; }
        }
      `}</style>

      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b px-3.5 py-2.5" style={{ borderColor: "#e0e0e0", background: "#f4f4f4" }}>
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#fda4af" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#fcd34d" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#86efac" }} />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border bg-white px-3 py-1" style={{ borderColor: "#e0e0e0" }}>
          <span className="truncate text-[11px]" style={{ color: "#525252", fontFamily: "var(--font-mono)" }}>
            Where people are already talking about you
          </span>
        </div>
        <span className="hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.1em] sm:inline-flex" style={{ color: "#0f62fe" }}>
          <span className="mfd-live inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#0f62fe" }} />
          Simulation
        </span>
      </div>

      <div className="space-y-2 px-4 py-5 md:px-5" style={{ minHeight: 320 }}>
        {MENTIONS.map((m, i) =>
          visible > i ? (
            <div
              key={`${m.source}-${i}`}
              className="mfd-row-in flex items-start gap-3 rounded-[4px] border px-3.5 py-3"
              style={
                m.flagged
                  ? { borderColor: "#f1938c", background: "#fff1f1" }
                  : { borderColor: "#e0e0e0" }
              }
            >
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white"
                style={{ borderColor: "#e0e0e0" }}
                aria-hidden
              >
                {SOURCE_META[m.source].badge}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-semibold" style={{ color: "#161616" }}>
                    {m.author}
                  </span>
                  <span className="text-[11px]" style={{ color: "#6f6f6f" }}>
                    on {SOURCE_META[m.source].label}
                  </span>
                  {m.flagged ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: "#a2191f" }}
                    >
                      <TriangleAlert className="h-3 w-3" aria-hidden />
                      Unanswered
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[13px] leading-snug" style={{ color: m.flagged ? "#a2191f" : "#525252" }}>
                  {m.text}
                </p>
              </div>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
