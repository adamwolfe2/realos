"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";

// ---------------------------------------------------------------------------
// AiAnswerDemo — animated mock of the four AI engines answering a renter
// prompt, for the /ai-visibility landing page. Cycles engines on a timer;
// each cycle "types" a recommendation list where three competitor slots
// fill in and the prospect's slot stays conspicuously absent. Pure CSS +
// one interval — no animation library. Respects prefers-reduced-motion by
// pinning to the first engine with everything visible.
//
// The names are sample data (generic building names), clearly labeled —
// the REAL version of this table is what the audit report delivers.
// ---------------------------------------------------------------------------

const ENGINES = [
  { key: "chatgpt", label: "ChatGPT", Mark: ChatGPTMark },
  { key: "perplexity", label: "Perplexity", Mark: PerplexityMark },
  { key: "claude", label: "Claude", Mark: ClaudeMark },
  { key: "gemini", label: "Gemini", Mark: GeminiMark },
] as const;

// Distinct sample competitor sets per engine so the cycle feels alive.
const SAMPLE_ANSWERS: Record<string, string[]> = {
  chatgpt: ["The Standard", "Varsity House", "Northside Commons"],
  perplexity: ["Varsity House", "The Metropolitan", "Campus Edge"],
  claude: ["Northside Commons", "The Standard", "Parkline Flats"],
  gemini: ["Campus Edge", "The Metropolitan", "Varsity House"],
};

const CYCLE_MS = 3600;
const ROW_STAGGER_MS = 420;

export function AiAnswerDemo() {
  const [engineIdx, setEngineIdx] = React.useState(0);
  const [visibleRows, setVisibleRows] = React.useState(0);
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches) {
      setVisibleRows(4);
      return;
    }
    let row = 0;
    setVisibleRows(0);
    // Reveal rows one by one, then hold, then advance to the next engine.
    const rowTimer = setInterval(() => {
      row += 1;
      setVisibleRows(row);
      if (row >= 4) clearInterval(rowTimer);
    }, ROW_STAGGER_MS);
    const cycleTimer = setTimeout(() => {
      setEngineIdx((i) => (i + 1) % ENGINES.length);
    }, CYCLE_MS);
    return () => {
      clearInterval(rowTimer);
      clearTimeout(cycleTimer);
    };
  }, [engineIdx]);

  const engine = ENGINES[engineIdx];
  const answers = SAMPLE_ANSWERS[engine.key];

  return (
    <div
      className="overflow-hidden rounded-[6px] border"
      style={{
        borderColor: "#E2E8F0",
        backgroundColor: "#FFFFFF",
        boxShadow:
          "0 12px 32px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04)",
      }}
    >
      {/* Engine tab bar */}
      <div
        className="flex items-center gap-1 border-b px-3 py-2"
        style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}
      >
        {ENGINES.map((e, i) => (
          <button
            key={e.key}
            type="button"
            onClick={() => !reduced && setEngineIdx(i)}
            className="inline-flex items-center gap-1.5 rounded-[3px] px-2.5 py-1.5 text-[12px] font-medium transition-colors"
            style={
              i === engineIdx
                ? { backgroundColor: "#FFFFFF", color: "#1E2A3A", boxShadow: "0 1px 3px rgba(15,23,42,0.1)" }
                : { color: "#64748B" }
            }
            aria-pressed={i === engineIdx}
          >
            <e.Mark size={14} />
            {e.label}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-5">
        {/* The renter's prompt */}
        <div className="mb-4 flex justify-end">
          <div
            className="max-w-[85%] rounded-[10px] rounded-br-[2px] px-3.5 py-2 text-[13px]"
            style={{ backgroundColor: "#2563EB", color: "#FFFFFF" }}
          >
            What are the best apartments near campus in Berkeley?
          </div>
        </div>

        {/* The engine's ranked answer */}
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 shrink-0">
            <engine.Mark size={20} />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            {answers.map((name, i) => (
              <div
                key={`${engine.key}-${name}`}
                className="flex items-center justify-between gap-2 rounded-[4px] border px-3 py-2 transition-all duration-300"
                style={{
                  borderColor: "#E2E8F0",
                  opacity: visibleRows > i ? 1 : 0,
                  transform: visibleRows > i ? "translateY(0)" : "translateY(4px)",
                }}
              >
                <span className="truncate text-[13px] font-medium" style={{ color: "#1E2A3A" }}>
                  {i + 1}. {name}
                </span>
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}
                >
                  <Check className="h-3 w-3" />
                  Recommended
                </span>
              </div>
            ))}

            {/* The empty slot — the reason this page exists */}
            <div
              className="flex items-center justify-between gap-2 rounded-[4px] border border-dashed px-3 py-2 transition-all duration-300"
              style={{
                borderColor: "#FCA5A5",
                backgroundColor: "#FEF2F2",
                opacity: visibleRows > 3 ? 1 : 0,
                transform: visibleRows > 3 ? "translateY(0)" : "translateY(4px)",
              }}
            >
              <span className="truncate text-[13px] font-semibold" style={{ color: "#B91C1C" }}>
                Your property
              </span>
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: "#FFFFFF", color: "#B91C1C" }}
              >
                <X className="h-3 w-3" />
                Not mentioned
              </span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px]" style={{ color: "#64748B" }}>
          Sample data. Your audit shows the real answers for your market.
        </p>
      </div>
    </div>
  );
}
