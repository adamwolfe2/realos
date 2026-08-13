import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { ReputationReportForm } from "@/components/audit/reputation-report-form";
import { MentionFeedDemo } from "@/components/audit/mention-feed-demo";
import { BookCallCta } from "@/components/audit/book-call-cta";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { CountUp } from "@/components/audit/count-up";
import { Atmosphere } from "@/components/home/atmosphere";

// ---------------------------------------------------------------------------
// /reputation-report — reputation front-door lead magnet. Clone of the
// /ai-visibility pattern: same form family (property name, website, email
// posted to /api/audit/start before the scan runs), same Atmosphere/display
// type/Carbon-blue/ls-hl visual voice, same sticky BookCallCta close. The
// difference is the hero artifact (MentionFeedDemo instead of AiAnswerDemo)
// and the report redirect, which lands on /audit/[token]#reputation instead
// of #ai-search.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Free Reputation Report | ${BRAND_NAME}`,
  description:
    "18 people talked about your property last quarter. Renters read all of it. Run a free reputation report: every mention across Google, Yelp, and Reddit, scored and prioritized.",
  alternates: { canonical: "/reputation-report" },
  robots: { index: true, follow: true },
};

const STATS = [
  { value: 18, suffix: "", label: "average mentions per quarter" },
  { value: 7, suffix: "", label: "review sources scanned" },
  { value: 4, suffix: "", label: "AI engines checked for your reputation" },
  { value: 2, suffix: " min", label: "to your full report" },
] as const;

const DELIVERABLES = [
  {
    n: "01",
    title: "Every mention, one place",
    body: "Google, Yelp, Reddit, and AI engine answers, pulled into a single feed instead of six tabs your team never checks.",
  },
  {
    n: "02",
    title: "What's flagged and unanswered",
    body: "The negative mentions renters actually read before they apply, ranked by how much they're costing you.",
  },
  {
    n: "03",
    title: "A prioritized fix list",
    body: "Which reviews need a reply, which patterns to fix at the property, written in plain English.",
  },
] as const;

export default function ReputationReportPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
      <style>{`
        @keyframes rrp-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .rrp-rise { animation: rrp-rise .7s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .rrp-rise { animation: none; } }
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
              className="rrp-rise mb-5 text-[11px] font-mono uppercase tracking-[0.18em]"
              style={{ color: "#0f62fe", fontFamily: "var(--font-mono)" }}
            >
              Free reputation report
            </p>
            <h1
              className="rrp-rise mx-auto"
              style={{
                animationDelay: "80ms",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(36px, 5.6vw, 68px)",
                fontWeight: 550,
                lineHeight: 1.06,
                letterSpacing: "-0.035em",
              }}
            >
              <CountUp to={18} /> people talked about
              <br />
              your property last quarter.
              <br />
              <span className="ls-hl px-2">Renters read all of it.</span>
            </h1>
            <p
              className="rrp-rise mx-auto mt-6 max-w-[54ch] text-[16px] leading-relaxed md:text-[17px]"
              style={{ animationDelay: "160ms", color: "#525252" }}
            >
              Every review, thread, and AI engine answer that mentions your
              property, most of them you've never seen. We scan them all and
              show you exactly what a prospect finds before they apply.
            </p>
            <div className="rrp-rise mt-7" style={{ animationDelay: "220ms" }}>
              <a
                href="#run-report"
                className="inline-flex items-center justify-center px-7 py-3.5 text-[15px] font-semibold text-white"
                style={{ backgroundColor: "#0f62fe", borderRadius: 2 }}
              >
                Run my free report
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Demo, then form ──────────────────────────────────────────── */}
      <section className="relative">
        <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-12 md:px-8 md:pb-24 md:pt-14">
          <div className="rrp-rise mx-auto max-w-[860px]" style={{ animationDelay: "120ms" }}>
            <MentionFeedDemo />

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

          <div id="run-report" className="mx-auto mt-12 max-w-[560px] scroll-mt-24 md:mt-16">
            <ReputationReportForm />
            <p className="mt-3 text-center text-[12px]" style={{ color: "#6f6f6f" }}>
              Your report is generated from live sources, then a human walks
              you through it if you want.
            </p>
          </div>
        </div>
      </section>

      {/* ── What the report shows ───────────────────────────────────── */}
      <section style={{ backgroundColor: "#f7f9fe" }}>
        <div className="mx-auto max-w-[1100px] px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-[720px]">
            <h2
              className="text-center"
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
        </div>
      </section>

      {/* ── Closing: the call is the conversion ─────────────────────── */}
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
            An unanswered review is
            <br />
            <span className="ls-hl px-2">a lost lease.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[48ch] text-[15px] leading-relaxed" style={{ color: "#525252" }}>
            Run the free report, then walk through your results with us on a
            15-minute call. We&apos;ll show you exactly what to fix first.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#run-report"
              className="inline-flex items-center justify-center px-6 py-3 text-[14px] font-semibold transition-colors"
              style={{ backgroundColor: "#0f62fe", color: "#ffffff", borderRadius: 2 }}
            >
              Run my free report
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

      <BookCallCta subtitle="Walk through your reputation report with our team" />
    </div>
  );
}
