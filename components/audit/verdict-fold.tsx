import type { ReactNode } from "react";
import { Atmosphere } from "@/components/home/atmosphere";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { CountUp } from "@/components/audit/count-up";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";

// ---------------------------------------------------------------------------
// VerdictFold — the executive fold of the /audit/[token] report.
//
// Replaces the old DpsHero card. One fold, one story: the property's name
// at display scale, a one-sentence verdict built from the report's real
// numbers, the score as a mono numeral with an animated fill bar, and the
// booking CTA. Visual voice matches /ai-visibility: Atmosphere backdrop,
// tight-tracked 550-weight display type, Carbon blue #0f62fe, mono
// numerals, rise-in entrance motion.
// ---------------------------------------------------------------------------

// `chip` is the darkened variant that stays AA (≥4.5) at 11px on the
// 8%-alpha wash; the base tone lands at ~4.4 there and fails axe.
type Tone = { text: string; bar: string; wash: string; chip: string };

// DPS is hard-capped at 75 (OVERALL_DPS_CAP) — no ≥80 band exists. A
// legend advertising a top band nobody can reach reads as a rigged
// scale on a public page (2026-08-14 review).
function toneFor(score: number): Tone {
  if (score >= 65) return { text: "#0f62fe", bar: "#0f62fe", wash: "rgba(15,98,254,0.08)", chip: "#0043ce" };
  if (score >= 45) return { text: "#b45309", bar: "#b45309", wash: "rgba(180,83,9,0.08)", chip: "#8a3800" };
  return { text: "#da1e28", bar: "#da1e28", wash: "rgba(218,30,40,0.08)", chip: "#a2191f" };
}

export type FoldStat = { value: number; suffix?: string; label: string };

/** Per-engine 3-state mini for the fold strip (2026-08-14). */
export type FoldEngine = {
  engine: "CHATGPT" | "PERPLEXITY" | "CLAUDE" | "GEMINI";
  state: "recommends" | "aware" | "unknown" | "cited" | "not_cited";
};

/** One pillar row for the fold's bar chart (2026-08-14). */
export type FoldPillar = { key: string; label: string; score: number };

export function VerdictFold({
  subject,
  generatedAtIso,
  score,
  highSeverity,
  verdict,
  stats,
  secondaryCta,
  engines,
  pillars,
}: {
  subject: string;
  generatedAtIso: string;
  /** Post-cap score 0-100. */
  score: number;
  highSeverity: number;
  /** One sentence. The page composes it from the report's real numbers. */
  verdict: ReactNode;
  /** Rule-divided mono stat band under the verdict. Max 3. */
  stats: FoldStat[];
  /** Second button next to Book a call. Locked reports jump straight to
   *  the email-unlock form; unlocked jump to the spine. */
  secondaryCta: { href: string; label: string };
  /** Per-engine 3-state strip rendered in the fold (2026-08-14).
   *  Empty/absent = no engine data (legacy) — strip hidden. */
  engines?: FoldEngine[];
  /** Six-pillar bar rows (2026-08-14). Absent = legacy audit. */
  pillars?: FoldPillar[];
}) {
  const tone = toneFor(score);
  const dateLabel = new Date(generatedAtIso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="relative overflow-hidden">
      <style>{`
        @keyframes aud-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .aud-rise { animation: aud-rise .7s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes aud-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .aud-fill { transform-origin: left; animation: aud-fill 1.1s cubic-bezier(.2,.8,.2,1) .45s both; }
        @keyframes aud-gauge { from { stroke-dashoffset: var(--gauge-c); } }
        .aud-gauge { animation: aud-gauge 1.1s cubic-bezier(.2,.8,.2,1) .45s both; }
        @media (prefers-reduced-motion: reduce) {
          .aud-rise { animation: none; }
          .aud-fill { animation: none; transform: scaleX(1); }
          .aud-gauge { animation: none; }
        }
      `}</style>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, #ffffff 0%, #ffffff 45%, #f7f9fe 100%)",
        }}
      />
      <Atmosphere />

      <div className="relative mx-auto max-w-[1100px] px-4 pb-12 pt-12 md:px-8 md:pb-16 md:pt-20">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.25fr_minmax(320px,0.75fr)] lg:gap-14">
          {/* ── Left: name + verdict + CTAs ─────────────────────────── */}
          <div>
            <p
              className="aud-rise text-[11px] font-mono uppercase tracking-[0.18em]"
              style={{ color: "#0f62fe", fontFamily: "var(--font-mono)" }}
            >
              Digital performance audit · {dateLabel}
            </p>
            <h1
              className="aud-rise mt-4"
              style={{
                animationDelay: "80ms",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(38px, 5.6vw, 66px)",
                fontWeight: 550,
                lineHeight: 1.04,
                letterSpacing: "-0.035em",
                color: "#161616",
                overflowWrap: "anywhere",
              }}
            >
              {subject}
            </h1>
            <p
              className="aud-rise mt-5 max-w-[56ch] text-[16.5px] leading-relaxed md:text-[18px]"
              style={{ animationDelay: "160ms", color: "#3d3d3d" }}
            >
              {verdict}
            </p>

            <div
              className="aud-rise mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ animationDelay: "240ms" }}
            >
              <BookDemoLink
                className="inline-flex items-center justify-center px-6 py-3 text-[14px] font-semibold text-white"
                style={{ backgroundColor: "#0f62fe", borderRadius: 2 }}
                ariaLabel="Book a 15-minute call about this report"
              >
                Book a 15-min call
              </BookDemoLink>
              <a
                href={secondaryCta.href}
                className="inline-flex items-center justify-center border px-6 py-3 text-[14px] font-semibold"
                style={{ borderColor: "#161616", color: "#161616", borderRadius: 2 }}
              >
                {secondaryCta.label}
              </a>
            </div>

            {/* Stat band: single rule-divided row, mono numerals. */}
            {stats.length > 0 ? (
              <div
                className="aud-rise mt-9 grid border-y sm:grid-cols-3"
                style={{
                  animationDelay: "320ms",
                  borderColor: "#e0e0e0",
                  gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, minmax(0, 1fr))`,
                }}
              >
                {stats.slice(0, 3).map((s, i) => (
                  <div
                    key={s.label}
                    className="py-4 pr-4"
                    style={{
                      paddingLeft: i === 0 ? 0 : 16,
                      borderLeft: i === 0 ? "none" : "1px solid #e0e0e0",
                    }}
                  >
                    <div
                      className="text-[24px] tabular-nums"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: 500,
                        color: "#161616",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      <CountUp to={s.value} />
                      {s.suffix ?? ""}
                    </div>
                    <div className="mt-0.5 text-[11.5px] leading-snug" style={{ color: "#6f6f6f" }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* ── Right: the score, mono numeral + animated fill bar ───── */}
          <div
            className="aud-rise border bg-white p-6"
            style={{
              animationDelay: "200ms",
              borderColor: "#e0e0e0",
              borderRadius: 2,
              boxShadow: "0 1px 2px rgba(22,22,22,0.04), 0 12px 32px rgba(22,22,22,0.05)",
            }}
          >
            <p
              className="text-[10.5px] font-mono uppercase tracking-[0.16em]"
              style={{ color: "#6f6f6f", fontFamily: "var(--font-mono)" }}
            >
              Digital Performance Score
            </p>
            <SemiGauge score={score} tone={tone} />
            {/* Threshold legend: orange-on-white alone says nothing about
                whether 47 is a crisis or merely mediocre (2026-08-14). */}
            <div
              className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"
              aria-hidden
            >
              {[
                { label: "0–44 critical", color: "#da1e28" },
                { label: "45–64 needs work", color: "#b45309" },
                { label: "65–75 strong · 75 is the ceiling", color: "#0f62fe" },
              ].map((t) => (
                <span
                  key={t.label}
                  className="inline-flex items-center gap-1 text-[10px] font-mono"
                  style={{ color: "#6f6f6f" }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  {t.label}
                </span>
              ))}
            </div>
            {engines && engines.length > 0 ? (
              <EngineStrip engines={engines} />
            ) : null}
            {pillars && pillars.length > 0 ? (
              <PillarBars pillars={pillars} />
            ) : null}
            {highSeverity > 0 ? (
              <p
                className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: tone.chip,
                  backgroundColor: tone.wash,
                  borderRadius: 999,
                }}
              >
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: tone.bar }}
                />
                {highSeverity} high-priority gap{highSeverity === 1 ? "" : "s"}
              </p>
            ) : null}
            <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "#6f6f6f" }}>
              {pillars && pillars.length > 0
                ? "Pillar-by-pillar detail in the appendix below."
                : "Scored across six pillars: findability, reputation, conversion, tracking, accessibility, listings. Full scorecard in the appendix below."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SemiGauge — semicircle score arc, pure SVG, CSS-only sweep. Matches the
// portal's ScoreRing look (thin track, rounded cap, tone color) in half-
// circle form so the fold reads as an instrument, not a bare numeral.
// ---------------------------------------------------------------------------
function SemiGauge({ score, tone }: { score: number; tone: Tone }) {
  const r = 84;
  const sw = 10;
  const w = 2 * r + sw;
  const h = r + sw;
  const c = Math.PI * r; // semicircle arc length
  const clamped = Math.max(0, Math.min(score, 100));
  const offset = c * (1 - clamped / 100);
  const d = `M ${sw / 2} ${h - sw / 2} A ${r} ${r} 0 0 1 ${w - sw / 2} ${h - sw / 2}`;
  // Cap tick at 75 — the structural ceiling. Marks why the arc can
  // never fill the last quarter.
  const theta = Math.PI * (1 - 0.75);
  const cx = w / 2;
  const cy = h - sw / 2;
  const tick = {
    x1: cx + (r - sw / 2 - 2) * Math.cos(theta),
    y1: cy - (r - sw / 2 - 2) * Math.sin(theta),
    x2: cx + (r + sw / 2 + 2) * Math.cos(theta),
    y2: cy - (r + sw / 2 + 2) * Math.sin(theta),
  };
  const band =
    clamped >= 65 ? "strong" : clamped >= 45 ? "needs work" : "critical";
  return (
    <div
      className="relative mt-3 mx-auto"
      style={{ maxWidth: 220 }}
      role="img"
      aria-label={`Digital Performance Score ${Math.round(clamped)} out of 100 (${band}; 75 is the structural ceiling)`}
    >
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" aria-hidden>
        <path d={d} fill="none" stroke="#f4f4f4" strokeWidth={sw} strokeLinecap="round" />
        <path
          d={d}
          className="aud-gauge"
          fill="none"
          stroke={tone.bar}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ ["--gauge-c" as string]: `${c}` }}
        />
        <line
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          stroke="#a8a8a8"
          strokeWidth={1.5}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex items-baseline justify-center gap-1">
        <CountUp
          to={clamped}
          className="tabular-nums leading-none"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 44,
            fontWeight: 500,
            letterSpacing: "-0.03em",
            color: tone.text,
          }}
        />
        <span
          className="text-[13px]"
          style={{ fontFamily: "var(--font-mono)", color: "#6f6f6f" }}
        >
          / 100
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EngineStrip — the per-engine 3-state minis in the fold (2026-08-14).
// Recommends (green) / Knows you only (amber) / Doesn't know you (red);
// legacy audits collapse to Named / Not named.
// ---------------------------------------------------------------------------
const ENGINE_STATE_META: Record<
  FoldEngine["state"],
  { label: string; color: string }
> = {
  recommends: { label: "Recommends you", color: "#24a148" },
  aware: { label: "Knows you only", color: "#b45309" },
  unknown: { label: "Doesn't know you", color: "#da1e28" },
  cited: { label: "Named you", color: "#0f62fe" },
  not_cited: { label: "Didn't name you", color: "#da1e28" },
};

function FoldEngineMark({ engine }: { engine: FoldEngine["engine"] }) {
  switch (engine) {
    case "CHATGPT":
      return <ChatGPTMark size={16} />;
    case "PERPLEXITY":
      return <PerplexityMark size={16} />;
    case "CLAUDE":
      return <ClaudeMark size={16} />;
    case "GEMINI":
      return <GeminiMark size={16} />;
  }
}

function EngineStrip({ engines }: { engines: FoldEngine[] }) {
  return (
    <ul
      className="mt-4 grid grid-cols-2 gap-1.5"
      aria-label="Per-engine AI visibility"
    >
      {engines.map((e) => {
        const meta = ENGINE_STATE_META[e.state];
        return (
          <li
            key={e.engine}
            className="flex items-center gap-1.5 border px-2 py-1.5"
            style={{ borderColor: "#e0e0e0", borderRadius: 2 }}
            title={meta.label}
          >
            <FoldEngineMark engine={e.engine} />
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: meta.color }}
              aria-hidden
            />
            <span
              className="truncate text-[10.5px] leading-tight"
              style={{ color: "#525252" }}
            >
              {meta.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// PillarBars — six thin single-hue bars; length encodes severity at a
// glance (Conversion 25 vs Reputation 67 must not carry identical visual
// weight — 2026-08-14). Mono numerals, direct labels, no legend.
// ---------------------------------------------------------------------------
function PillarBars({ pillars }: { pillars: FoldPillar[] }) {
  return (
    <div className="mt-4" role="group" aria-label="Pillar scores">
      {pillars.map((p) => (
        <div key={p.key} className="mt-1.5 flex items-center gap-2">
          <span
            className="w-24 shrink-0 truncate text-[11px]"
            style={{ color: "#525252" }}
          >
            {p.label}
          </span>
          <span
            className="h-[5px] flex-1 overflow-hidden"
            style={{ backgroundColor: "#f4f4f4", borderRadius: 2 }}
            aria-hidden
          >
            <span
              className="block h-full"
              style={{
                width: `${Math.max(2, Math.min(p.score, 100))}%`,
                backgroundColor: "#0f62fe",
                borderRadius: 2,
              }}
            />
          </span>
          <span
            className="w-7 text-right text-[11px] tabular-nums"
            style={{ fontFamily: "var(--font-mono)", color: "#161616" }}
          >
            {p.score}
          </span>
        </div>
      ))}
    </div>
  );
}
