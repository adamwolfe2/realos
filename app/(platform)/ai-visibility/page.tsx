import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { AiVisibilityForm } from "@/components/audit/ai-visibility-form";
import { AiAnswerDemo } from "@/components/audit/ai-answer-demo";
import { BookCallCta } from "@/components/audit/book-call-cta";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { CountUp } from "@/components/audit/count-up";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";

// ---------------------------------------------------------------------------
// /ai-visibility — public AI-search audit lead magnet.
//
// AI-search-specific front door to the existing prospect-audit engine
// (/api/audit/start → scan → /audit/[token]#ai-search). Every submission
// captures email BEFORE the scan runs, so the ProspectAudit row is a
// contactable lead even if the prospect bounces mid-scan. Page goal:
// run the audit, then book the call — sticky BookCallCta + closing
// BookDemoLink both route to the Cal.com booking (Norman's link via
// NEXT_PUBLIC_CAL_BOOK_URL).
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Free AI Visibility Audit | ${BRAND_NAME}`,
  description:
    "Does ChatGPT recommend your property? Run a free AI visibility audit: see which AI engines cite you, which competitors they recommend instead, and exactly how to fix it.",
  alternates: { canonical: "/ai-visibility" },
  robots: { index: true, follow: true },
};

const ENGINE_LOGOS = [
  { label: "ChatGPT", Mark: ChatGPTMark },
  { label: "Perplexity", Mark: PerplexityMark },
  { label: "Claude", Mark: ClaudeMark },
  { label: "Gemini", Mark: GeminiMark },
] as const;

const STATS: Array<{ value: number; suffix: string; label: string }> = [
  { value: 4, suffix: "", label: "AI engines queried live" },
  { value: 20, suffix: "+", label: "renter prompts tested" },
  { value: 7, suffix: "", label: "review sources scanned" },
  { value: 2, suffix: " min", label: "to your full report" },
];

const DELIVERABLES: Array<{ title: string; body: string }> = [
  {
    title: "Per-engine verdict",
    body: "Which of the four major AI engines mention your property by name, and which link to your site — checked live, not estimated.",
  },
  {
    title: "Who wins instead",
    body: "The exact competitor buildings the AI recommends when a prospect asks about your market — the demand you're losing today.",
  },
  {
    title: "A prioritized fix list",
    body: "Schema gaps, missing FAQ blocks, citability failures on your homepage — ranked by impact, in plain English.",
  },
];

export default function AiVisibilityPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="mx-auto max-w-[1100px] px-4 pt-20 md:px-8 md:pt-24">
          <div className="ls-page-fade mx-auto max-w-3xl text-center">
            <p
              className="mb-4 text-[11px] font-mono uppercase tracking-[0.18em]"
              style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
            >
              Free AI visibility audit
            </p>
            <h1 className="text-[36px] font-semibold leading-[1.08] tracking-[-0.02em] md:text-[52px]">
              When renters ask ChatGPT where to live,
              <span
                className="px-1"
                style={{ backgroundColor: "#DBEAFE" }}
              >
                does it say your name?
              </span>
            </h1>
            <p
              className="mx-auto mt-5 max-w-[52ch] text-[16px] leading-relaxed md:text-[17px]"
              style={{ color: "#475569" }}
            >
              Prospects ask AI engines for apartment recommendations before
              they ever open Google. We query all four major engines about
              your market and your property — live — and show you exactly
              where you stand.
            </p>

            {/* Big engine logos under the H1 */}
            <div className="ls-stagger mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 md:gap-x-14">
              {ENGINE_LOGOS.map(({ label, Mark }) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <Mark size={44} />
                  <span
                    className="text-[12px] font-medium"
                    style={{ color: "#64748B" }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Demo + form ──────────────────────────────────────────────── */}
      <section className="relative">
        <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-14 md:px-8 md:pb-20 md:pt-16">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
              <AiAnswerDemo />
              <div className="ls-stagger mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
                {STATS.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-[4px] border px-3 py-4 text-center"
                    style={{ borderColor: "#E2E8F0" }}
                  >
                    <div
                      className="text-[24px] font-semibold tabular-nums tracking-tight"
                      style={{ color: "#1E2A3A" }}
                    >
                      <CountUp to={s.value} />
                      {s.suffix}
                    </div>
                    <div
                      className="mt-1 text-[11px] leading-snug"
                      style={{ color: "#64748B" }}
                    >
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div id="run-audit" className="scroll-mt-24 lg:sticky lg:top-24">
              <AiVisibilityForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── What the report contains ─────────────────────────────────── */}
      <section style={{ backgroundColor: "#F8FAFC" }}>
        <div className="mx-auto max-w-[1100px] px-4 py-14 md:px-8 md:py-20">
          <h2 className="text-center text-[24px] font-semibold tracking-[-0.01em] md:text-[30px]">
            What your report shows
          </h2>
          <div className="ls-stagger mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {DELIVERABLES.map((d) => (
              <div
                key={d.title}
                className="rounded-[4px] border p-5"
                style={{ borderColor: "#E2E8F0", backgroundColor: "#FFFFFF" }}
              >
                <h3 className="text-[15px] font-semibold">{d.title}</h3>
                <p
                  className="mt-2 text-[13.5px] leading-relaxed"
                  style={{ color: "#64748B" }}
                >
                  {d.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA — the call is the conversion ─────────────────── */}
      <section>
        <div className="mx-auto max-w-[760px] px-4 py-16 text-center md:px-8 md:py-24">
          <h2 className="text-[26px] font-semibold tracking-[-0.01em] md:text-[34px]">
            Invisible to AI search is invisible to renters.
          </h2>
          <p
            className="mx-auto mt-4 max-w-[48ch] text-[15px] leading-relaxed"
            style={{ color: "#475569" }}
          >
            Run the free audit, then walk through your results with us on a
            15-minute call — we&apos;ll show you exactly what it takes to get
            your property cited.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#run-audit"
              className="inline-flex items-center justify-center rounded-[2px] px-6 py-3 text-[14px] font-semibold"
              style={{ backgroundColor: "#2563EB", color: "#FFFFFF" }}
            >
              Run my free audit
            </a>
            <BookDemoLink
              className="inline-flex items-center justify-center rounded-[2px] border px-6 py-3 text-[14px] font-semibold"
              style={{ borderColor: "#1E2A3A", color: "#1E2A3A" }}
              ariaLabel="Book a 15-minute call (opens scheduling)"
            >
              Book a 15-min call
            </BookDemoLink>
          </div>
        </div>
      </section>

      {/* Sticky bottom booking bar — stays one click away while scrolling. */}
      <BookCallCta subtitle="Walk through your AI visibility results with our team" />
    </div>
  );
}
