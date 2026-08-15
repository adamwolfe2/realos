import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { AiVisibilityForm } from "@/components/audit/ai-visibility-form";
import { AiAnswerDemo } from "@/components/audit/ai-answer-demo";
import { BookCallCta } from "@/components/audit/book-call-cta";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { CountUp } from "@/components/audit/count-up";
import { Atmosphere } from "@/components/home/atmosphere";
import { ReportSnapshotMock } from "@/components/home/report-snapshot-mock";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";

// ---------------------------------------------------------------------------
// /ai-visibility — public AI-search audit lead magnet.
//
// Brand-register surface in the homepage's visual voice: Atmosphere grid
// backdrop, oversized tight-tracked display type, Carbon-blue commitment.
// The logo moment is an orbit: the four engine marks circling the
// prospect's property node, CSS-only, paused for reduced motion. Funnel:
// run the audit (form posts into the existing prospect-audit engine),
// then book the call (sticky BookCallCta + closing BookDemoLink).
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Free AI Visibility Audit | ${BRAND_NAME}`,
  description:
    "Does ChatGPT recommend your property? Run a free AI visibility audit: see which AI engines cite you, which competitors they recommend instead, and exactly how to fix it.",
  alternates: { canonical: "/ai-visibility" },
  robots: { index: true, follow: true },
};

const ORBIT = [
  { label: "ChatGPT", Mark: ChatGPTMark },
  { label: "Perplexity", Mark: PerplexityMark },
  { label: "Claude", Mark: ClaudeMark },
  { label: "Gemini", Mark: GeminiMark },
] as const;

const STATS = [
  { value: 4, suffix: "", label: "AI engines queried live" },
  { value: 20, suffix: "+", label: "renter prompts tested" },
  { value: 7, suffix: "", label: "review sources scanned" },
  { value: 2, suffix: " min", label: "to your full report" },
] as const;

const DELIVERABLES = [
  {
    n: "01",
    title: "Per-engine verdict",
    body: "Which of the four major AI engines mention your property by name, and which link to your site. Checked live against real engines, not estimated.",
  },
  {
    n: "02",
    title: "Who wins instead",
    body: "The exact competitor buildings the AI recommends when a prospect asks about your market. That list is the demand you're losing today.",
  },
  {
    n: "03",
    title: "A prioritized fix list",
    body: "Schema gaps, missing FAQ blocks, citability failures on your homepage. Ranked by impact, written in plain English.",
  },
] as const;

export default function AiVisibilityPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <style>{`
        /* Headline engine ticker: the four engine names (word + mark)
           stack in one inline-grid cell and take 3s turns. Rise-in from
           below, rise-out above, exponential ease. Width is the widest
           word so the headline never reflows. */
        .aiv-tick { display: inline-grid; vertical-align: baseline; white-space: nowrap; }
        .aiv-tick > span { grid-area: 1 / 1; display: inline-flex; align-items: center; gap: .18em;
          justify-self: start; opacity: 0; animation: aiv-tick-cycle 12s cubic-bezier(.2,.8,.2,1) infinite; }
        .aiv-tick svg { width: .72em; height: .72em; }
        @keyframes aiv-tick-cycle {
          0% { opacity: 0; transform: translateY(.45em); }
          3.5% { opacity: 1; transform: translateY(0); }
          22.5% { opacity: 1; transform: translateY(0); }
          26% { opacity: 0; transform: translateY(-.45em); }
          100% { opacity: 0; transform: translateY(.45em); }
        }
        @media (prefers-reduced-motion: reduce) {
          .aiv-tick > span { animation: none; }
          .aiv-tick > span:first-child { opacity: 1; transform: none; }
        }
      `}</style>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #ffffff 0%, #ffffff 40%, #f7f9fe 100%)",
          }}
        />
        <Atmosphere />

        <div className="relative mx-auto max-w-[1100px] px-4 pt-16 md:px-8 md:pt-24">
          <div className="mx-auto max-w-[880px] text-center">
            <p
              className="ls-rise mb-5 text-[11px] font-mono uppercase tracking-[0.18em]"
              style={{ color: "#0f62fe", fontFamily: "var(--font-mono)" }}
            >
              Free AI visibility audit
            </p>
            <h1
              className="ls-rise mx-auto"
              style={{
                animationDelay: "80ms",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(40px, 6.4vw, 74px)",
                fontWeight: 550,
                lineHeight: 1.04,
                letterSpacing: "-0.035em",
              }}
            >
              Renters ask{" "}
              <span className="sr-only">ChatGPT, Perplexity, Claude, and Gemini</span>
              <span className="aiv-tick" aria-hidden>
                {ORBIT.map(({ label, Mark }, i) => (
                  <span key={label} style={{ animationDelay: `${i * 3}s` }}>
                    {label}
                    <Mark size={48} />
                  </span>
                ))}
              </span>
              <br />
              where to live.
              <br />
              <span className="ls-hl px-2">Does it say your name?</span>
            </h1>
            <p
              className="ls-rise mx-auto mt-6 max-w-[54ch] text-[16px] leading-relaxed md:text-[17px]"
              style={{ animationDelay: "160ms", color: "#525252" }}
            >
              Prospects ask AI engines for apartment recommendations before
              they ever open Google. We query all four major engines about
              your market and your property, live, and show you exactly
              where you stand.
            </p>
            <div className="ls-rise mt-7" style={{ animationDelay: "220ms" }}>
              <a
                href="#run-audit"
                className="inline-flex items-center justify-center px-7 py-3.5 text-[15px] font-semibold text-white"
                style={{ backgroundColor: "#0f62fe", borderRadius: 2 }}
              >
                Run my free audit
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* ── Demo, then form (Adam 2026-08-13: animation directly under
          the H1 + button, wider; form stacked below it) ─────────────── */}
      <section className="relative">
        <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-12 md:px-8 md:pb-24 md:pt-14">
          <div className="ls-rise mx-auto max-w-[860px]" style={{ animationDelay: "120ms" }}>
            <AiAnswerDemo />

            {/* Stat strip: single rule-divided band, mono numerals. */}
            <div
              className="mt-8 grid grid-cols-2 divide-y border-y sm:grid-cols-4 sm:divide-x sm:divide-y-0"
              style={{ borderColor: "#e0e0e0" }}
            >
              {STATS.map((s) => (
                <div key={s.label} className="px-4 py-5 first:pl-0 sm:py-4" style={{ borderColor: "#e0e0e0" }}>
                  <div
                    className="text-[26px] tabular-nums"
                    style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "#161616", letterSpacing: "-0.02em" }}
                  >
                    <CountUp to={s.value} />
                    {s.suffix}
                  </div>
                  <div className="mt-0.5 text-[11.5px] leading-snug" style={{ color: "#6f6f6f" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="run-audit" className="mx-auto mt-12 max-w-[560px] scroll-mt-24 md:mt-16">
            <AiVisibilityForm />
            <p className="mt-3 text-center text-[12px]" style={{ color: "#6f6f6f" }}>
              Your report is generated from live engine responses, then a
              human walks you through it if you want.
            </p>
          </div>
        </div>
      </section>

      {/* ── What the report shows — editorial rows beside the artifact ── */}
      <section style={{ backgroundColor: "#f7f9fe" }}>
        <div className="mx-auto max-w-[1100px] px-4 py-16 md:px-8 md:py-24">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(26px, 3.4vw, 38px)",
                  fontWeight: 550,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                }}
              >
                One report. Three answers your owner will ask for.
              </h2>
              <div className="mt-8">
                {DELIVERABLES.map((d, i) => (
                  <div
                    key={d.n}
                    className="flex gap-5 py-5"
                    style={{ borderTop: i === 0 ? "none" : "1px solid #dde3f0" }}
                  >
                    <span
                      className="mt-0.5 text-[13px] tabular-nums"
                      style={{ fontFamily: "var(--font-mono)", color: "#0f62fe" }}
                    >
                      {d.n}
                    </span>
                    <div>
                      <h3 className="text-[16px] font-semibold" style={{ color: "#161616" }}>
                        {d.title}
                      </h3>
                      <p className="mt-1.5 max-w-[52ch] text-[14px] leading-relaxed" style={{ color: "#525252" }}>
                        {d.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden lg:block">
              <ReportSnapshotMock />
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing: the call is the conversion ──────────────────────── */}
      <section>
        <div className="mx-auto max-w-[820px] px-4 py-16 text-center md:px-8 md:py-24">
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 550,
              letterSpacing: "-0.03em",
              lineHeight: 1.08,
            }}
          >
            Invisible to AI search is
            <br />
            <span className="ls-hl px-2">invisible to renters.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[48ch] text-[15px] leading-relaxed" style={{ color: "#525252" }}>
            Run the free audit, then walk through your results with us on a
            15-minute call. We&apos;ll show you exactly what it takes to get
            your property cited.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#run-audit"
              className="inline-flex items-center justify-center px-6 py-3 text-[14px] font-semibold transition-colors"
              style={{ backgroundColor: "#0f62fe", color: "#ffffff", borderRadius: 2 }}
            >
              Run my free audit
            </a>
            <BookDemoLink
              className="inline-flex items-center justify-center border px-6 py-3 text-[14px] font-semibold"
              style={{ borderColor: "#161616", color: "#161616", borderRadius: 2 }}
              ariaLabel="Book a 15-minute call (opens scheduling)"
            >
              Book a 15-min call
            </BookDemoLink>
          </div>
        </div>
      </section>

      <BookCallCta subtitle="Walk through your AI visibility results with our team" />
    </div>
  );
}
