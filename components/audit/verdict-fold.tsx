import type { ReactNode } from "react";
import { Atmosphere } from "@/components/home/atmosphere";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { CountUp } from "@/components/audit/count-up";

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

function toneFor(score: number): Tone {
  if (score >= 80) return { text: "#24a148", bar: "#24a148", wash: "rgba(36,161,72,0.08)", chip: "#0e6027" };
  if (score >= 65) return { text: "#0f62fe", bar: "#0f62fe", wash: "rgba(15,98,254,0.08)", chip: "#0043ce" };
  if (score >= 45) return { text: "#b45309", bar: "#b45309", wash: "rgba(180,83,9,0.08)", chip: "#8a3800" };
  return { text: "#da1e28", bar: "#da1e28", wash: "rgba(218,30,40,0.08)", chip: "#a2191f" };
}

export type FoldStat = { value: number; suffix?: string; label: string };

export function VerdictFold({
  subject,
  generatedAtIso,
  score,
  highSeverity,
  verdict,
  stats,
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
        @media (prefers-reduced-motion: reduce) {
          .aud-rise { animation: none; }
          .aud-fill { animation: none; transform: scaleX(1); }
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
                href="#three-things"
                className="inline-flex items-center justify-center border px-6 py-3 text-[14px] font-semibold"
                style={{ borderColor: "#161616", color: "#161616", borderRadius: 2 }}
              >
                See the 3 things below
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
            <div className="mt-2 flex items-baseline gap-2">
              <CountUp
                to={score}
                className="tabular-nums leading-none"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 64,
                  fontWeight: 500,
                  letterSpacing: "-0.03em",
                  color: tone.text,
                }}
              />
              <span
                className="text-[15px]"
                style={{ fontFamily: "var(--font-mono)", color: "#6f6f6f" }}
              >
                / 100
              </span>
            </div>
            <div
              className="mt-4 h-[3px] w-full overflow-hidden"
              style={{ backgroundColor: "#f4f4f4" }}
              aria-hidden
            >
              <div
                className="aud-fill h-full"
                style={{
                  width: `${Math.max(0, Math.min(score, 100))}%`,
                  backgroundColor: tone.bar,
                }}
              />
            </div>
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
              Scored across six pillars: findability, reputation, conversion,
              tracking, accessibility, listings. Full scorecard in the
              appendix below.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
