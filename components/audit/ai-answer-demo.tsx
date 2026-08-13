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
// AiAnswerDemo v2 — a staged, app-window simulation of the four AI engines
// answering a renter prompt. Phased state machine per engine cycle:
//
//   typing   the renter's prompt types in character by character
//   thinking the engine shows a three-dot typing indicator
//   answering recommendation rows spring in one at a time
//   verdict  the dashed "Your property — not mentioned" slot lands + pulses
//   hold     share-of-answer bars settle, then the next engine takes over
//
// Chrome: browser window with traffic lights + per-engine address bar.
// All motion is CSS keyframes defined in the local <style>; reduced motion
// renders the final state statically and disables the auto-cycle.
// ---------------------------------------------------------------------------

const ENGINES = [
  { key: "chatgpt", label: "ChatGPT", host: "chatgpt.com", Mark: ChatGPTMark },
  { key: "perplexity", label: "Perplexity", host: "perplexity.ai", Mark: PerplexityMark },
  { key: "claude", label: "Claude", host: "claude.ai", Mark: ClaudeMark },
  { key: "gemini", label: "Gemini", host: "gemini.google.com", Mark: GeminiMark },
] as const;

type EngineKey = (typeof ENGINES)[number]["key"];

const PROMPT = "What are the best apartments near campus in Berkeley?";

const SAMPLE_ANSWERS: Record<EngineKey, string[]> = {
  chatgpt: ["The Standard", "Varsity House", "Northside Commons"],
  perplexity: ["Varsity House", "The Metropolitan", "Campus Edge"],
  claude: ["Northside Commons", "The Standard", "Parkline Flats"],
  gemini: ["Campus Edge", "The Metropolitan", "Varsity House"],
};

// Share-of-answer bars shown in the footer strip. Static sample data;
// the audit report renders the real ones.
const SAMPLE_SOV: Record<EngineKey, number> = {
  chatgpt: 0.34,
  perplexity: 0.27,
  claude: 0.22,
  gemini: 0.17,
};

type Phase = "typing" | "thinking" | "answering" | "verdict" | "hold";

const TYPE_MS = 26;
const THINK_MS = 900;
const ROW_MS = 380;
const VERDICT_HOLD_MS = 2600;

export function AiAnswerDemo() {
  const [engineIdx, setEngineIdx] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>("typing");
  const [typed, setTyped] = React.useState(0);
  const [rows, setRows] = React.useState(0);
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Phase machine. One effect drives the whole cycle off timers keyed by
  // (engineIdx, phase). Reduced motion short-circuits to the final frame.
  React.useEffect(() => {
    if (reduced) {
      setTyped(PROMPT.length);
      setRows(4);
      setPhase("hold");
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (typed < PROMPT.length) {
        t = setTimeout(() => setTyped((n) => n + 2), TYPE_MS);
      } else {
        t = setTimeout(() => setPhase("thinking"), 250);
      }
    } else if (phase === "thinking") {
      t = setTimeout(() => setPhase("answering"), THINK_MS);
    } else if (phase === "answering") {
      if (rows < 3) {
        t = setTimeout(() => setRows((n) => n + 1), ROW_MS);
      } else {
        t = setTimeout(() => {
          setRows(4);
          setPhase("verdict");
        }, ROW_MS);
      }
    } else if (phase === "verdict") {
      t = setTimeout(() => setPhase("hold"), 500);
    } else {
      t = setTimeout(() => {
        setEngineIdx((i) => (i + 1) % ENGINES.length);
        setTyped(0);
        setRows(0);
        setPhase("typing");
      }, VERDICT_HOLD_MS);
    }
    return () => clearTimeout(t);
  }, [phase, typed, rows, engineIdx, reduced]);

  function jumpTo(i: number) {
    setEngineIdx(i);
    if (reduced) return;
    setTyped(PROMPT.length);
    setRows(0);
    setPhase("thinking");
  }

  const engine = ENGINES[engineIdx];
  const answers = SAMPLE_ANSWERS[engine.key];
  const promptDone = typed >= PROMPT.length;

  return (
    <div className="aad-root">
      <style>{`
        .aad-root { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; background: #fff;
          box-shadow: 0 2px 4px rgba(15,23,42,.05), 0 16px 40px rgba(15,23,42,.09); }
        @keyframes aad-blink { 0%, 55% { opacity: 1; } 56%, 100% { opacity: 0; } }
        @keyframes aad-dot { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-4px); opacity: 1; } }
        @keyframes aad-row { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes aad-verdict { 0% { opacity: 0; transform: translateY(8px); } 55% { opacity: 1; transform: translateY(0); }
          70% { transform: translateX(-2px); } 85% { transform: translateX(2px); } 100% { transform: translateX(0); } }
        @keyframes aad-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        @keyframes aad-bar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .aad-caret { display: inline-block; width: 2px; height: 1em; background: #161616; vertical-align: text-bottom;
          margin-left: 1px; animation: aad-blink 1s step-end infinite; }
        .aad-dots span { display: inline-block; width: 5px; height: 5px; border-radius: 999px; background: #6f6f6f;
          margin-right: 3px; animation: aad-dot 1.2s ease-in-out infinite; }
        .aad-dots span:nth-child(2) { animation-delay: .15s; }
        .aad-dots span:nth-child(3) { animation-delay: .3s; }
        .aad-row-in { animation: aad-row .42s cubic-bezier(.2,.8,.2,1) both; }
        .aad-verdict-in { animation: aad-verdict .7s cubic-bezier(.2,.8,.2,1) both; }
        .aad-live { animation: aad-pulse 2s ease-in-out infinite; }
        .aad-bar { transform-origin: left center; animation: aad-bar .8s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .aad-caret, .aad-dots span, .aad-live { animation: none; }
          .aad-row-in, .aad-verdict-in, .aad-bar { animation: none; opacity: 1; transform: none; }
        }
      `}</style>

      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b px-3.5 py-2.5" style={{ borderColor: "#e0e0e0", background: "#f4f4f4" }}>
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#fda4af" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#fcd34d" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#86efac" }} />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border bg-white px-3 py-1"
          style={{ borderColor: "#e0e0e0" }}>
          <engine.Mark size={11} />
          <span className="truncate text-[11px]" style={{ color: "#525252", fontFamily: "var(--font-mono)" }}>
            {engine.host}
          </span>
        </div>
        <span className="hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.1em] sm:inline-flex" style={{ color: "#0f62fe" }}>
          <span className="aad-live inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#0f62fe" }} />
          Simulation
        </span>
      </div>

      {/* Engine tabs */}
      <div className="flex items-center gap-1 border-b px-2.5 py-2" style={{ borderColor: "#e0e0e0" }}>
        {ENGINES.map((e, i) => (
          <button key={e.key} type="button" onClick={() => jumpTo(i)} aria-pressed={i === engineIdx}
            className="inline-flex items-center gap-1.5 rounded-[3px] px-2.5 py-1.5 text-[12px] font-medium transition-all duration-200"
            style={i === engineIdx
              ? { background: "#edf5ff", color: "#0043ce", boxShadow: "inset 0 0 0 1px #0f62fe33" }
              : { color: "#6f6f6f" }}>
            <e.Mark size={14} />
            <span className="hidden sm:inline">{e.label}</span>
          </button>
        ))}
      </div>

      <div className="px-4 pb-4 pt-5 md:px-5" style={{ minHeight: 320 }}>
        {/* Renter prompt, typed live */}
        <div className="mb-5 flex justify-end">
          <div className="max-w-[88%] rounded-[12px] rounded-br-[3px] px-4 py-2.5 text-[13px] leading-relaxed"
            style={{ background: "#0f62fe", color: "#fff", boxShadow: "0 4px 12px rgba(15,98,254,.25)" }}>
            {PROMPT.slice(0, typed)}
            {!promptDone ? <span className="aad-caret" style={{ background: "#fff" }} /> : null}
          </div>
        </div>

        {/* Engine response area */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white"
            style={{ borderColor: "#e0e0e0", boxShadow: "0 1px 3px rgba(15,23,42,.08)" }}>
            <engine.Mark size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2 text-[11px]" style={{ color: "#6f6f6f" }}>
              <span className="font-semibold" style={{ color: "#161616" }}>{engine.label}</span>
              {phase === "thinking" ? (
                <span className="aad-dots" aria-label="Thinking"><span /><span /><span /></span>
              ) : phase === "typing" ? (
                <span>waiting…</span>
              ) : (
                <span>ranked answer</span>
              )}
            </div>

            <div className="space-y-1.5">
              {answers.map((name, i) => (rows > i ? (
                <div key={`${engine.key}-${name}`} className="aad-row-in flex items-center justify-between gap-2 rounded-[4px] border px-3 py-2"
                  style={{ borderColor: "#e0e0e0", animationDelay: `${i * 60}ms` }}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{ background: "#f4f4f4", color: "#525252", fontFamily: "var(--font-mono)" }}>
                      {i + 1}
                    </span>
                    <span className="truncate text-[13px] font-medium" style={{ color: "#161616" }}>{name}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: "#defbe6", color: "#0e6027" }}>
                    <Check className="h-3 w-3" />
                    <span className="hidden sm:inline">Recommended</span>
                  </span>
                </div>
              ) : null))}

              {rows > 3 ? (
                <div className="aad-verdict-in flex items-center justify-between gap-2 rounded-[4px] border border-dashed px-3 py-2.5"
                  style={{ borderColor: "#f1938c", background: "#fff1f1" }}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ background: "#ffd7d9", color: "#a2191f" }}>?</span>
                    <span className="truncate text-[13px] font-semibold" style={{ color: "#a2191f" }}>Your property</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "#a2191f" }}>
                    <X className="h-3 w-3" />
                    Not mentioned
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Share-of-answer footer strip */}
      <div className="border-t px-4 py-3 md:px-5" style={{ borderColor: "#e0e0e0", background: "#fafafa" }}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[.1em]" style={{ color: "#6f6f6f" }}>
            Who owns the answer
          </span>
          <span className="text-[10px]" style={{ color: "#6f6f6f" }}>sample data</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {ENGINES.map((e) => (
            <div key={e.key}>
              <div className="mb-1 flex items-center gap-1">
                <e.Mark size={10} />
                <span className="text-[10px] tabular-nums" style={{ color: "#525252", fontFamily: "var(--font-mono)" }}>
                  {Math.round(SAMPLE_SOV[e.key] * 100)}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full" style={{ background: "#e0e0e0" }}>
                <div key={`${engine.key}-${e.key}`} className="aad-bar h-full rounded-full"
                  style={{ width: `${SAMPLE_SOV[e.key] * 100}%`, background: e.key === engine.key ? "#0f62fe" : "#a6c8ff" }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-[11px]" style={{ color: "#6f6f6f" }}>
          Competitors own the answer on every engine. The audit shows the real split for your market.
        </p>
      </div>
    </div>
  );
}
