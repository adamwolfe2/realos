import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { Atmosphere } from "@/components/home/atmosphere";
import { LostLeadsCalculator } from "@/components/marketing/lost-leads-calculator";
import { BookCallCta } from "@/components/audit/book-call-cta";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// ---------------------------------------------------------------------------
// /lost-leads — pixel lead magnet. Pure client-side math: monthly visitors
// minus monthly leads = renters who showed up and left unnamed. No invented
// multiplier — PRODUCT.md only grounds "a meaningful share," not a specific
// percentage, so the headline number is exactly what the prospect typed in.
// Same visual voice as /ai-visibility and /build-a-chatbot: Atmosphere,
// 550-weight display type, Carbon blue, ls-hl marker highlight, mono
// numerals. Email gate writes an IntakeSubmission (selectedModules:
// ["pixel"]) via the same /api/onboarding contract as /build-a-chatbot.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Lost-Lead Calculator | ${BRAND_NAME}`,
  description:
    "See how many renters visit your site and leave without a name or email attached, every month. Type in two numbers, get the math instantly.",
  alternates: { canonical: "/lost-leads" },
  robots: { index: true, follow: true },
};

const HOW = [
  {
    n: "01",
    title: "Type in two numbers",
    body: "Monthly visitors and monthly leads. Both are already in your analytics and your CRM.",
  },
  {
    n: "02",
    title: "See the gap",
    body: "The calculator does one subtraction, live, no invented multiplier. That's the number of renters who visited and left with no name attached.",
  },
  {
    n: "03",
    title: "Put names on it",
    body: "LeaseStack's pixel resolves a meaningful share of that traffic to a real name and email, fed straight into your CRM and ad audiences.",
  },
] as const;

export default function LostLeadsPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#161616" }}>
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
          <div className="mx-auto max-w-[820px] text-center">
            <p
              className="ls-rise mb-5 text-[11px] font-mono uppercase tracking-[0.18em]"
              style={{ color: "#0f62fe", fontFamily: "var(--font-mono)" }}
            >
              Free lost-lead calculator
            </p>
            <h1
              className="ls-rise mx-auto"
              style={{
                animationDelay: "80ms",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(36px, 5.6vw, 64px)",
                fontWeight: 550,
                lineHeight: 1.06,
                letterSpacing: "-0.035em",
              }}
            >
              Renters visit your site
              <br />
              and leave <span className="ls-hl px-2">with no name on it.</span>
            </h1>
            <p
              className="ls-rise mx-auto mt-6 max-w-[54ch] text-[16px] leading-relaxed md:text-[17px]"
              style={{ animationDelay: "160ms", color: "#525252" }}
            >
              Two numbers — visitors, leads — is all it takes to see the gap.
              No invented multiplier, just the subtraction.
            </p>
          </div>
        </div>
      </section>

      {/* ── The calculator ──────────────────────────────────────────── */}
      <section className="relative">
        <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-12 md:px-8 md:pb-24 md:pt-14">
          <div className="ls-rise mx-auto max-w-[720px]" style={{ animationDelay: "120ms" }}>
            <LostLeadsCalculator />
          </div>
        </div>
      </section>

      {/* ── How it works — editorial rows ───────────────────────────── */}
      <section style={{ backgroundColor: "#f7f9fe" }}>
        <div className="mx-auto max-w-[1100px] px-4 py-16 md:px-8 md:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
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
                Every anonymous visitor was a real renter, once.
              </h2>
              <p
                className="mt-4 max-w-[52ch] text-[15px] leading-relaxed"
                style={{ color: "#525252" }}
              >
                They looked at floor plans, checked pricing, maybe read a
                review or two. Then they left without filling out a form.
                That&apos;s not lost interest — it&apos;s a lead your stack
                never captured.
              </p>
            </div>
            <div>
              {HOW.map((d, i) => (
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
                    <p
                      className="mt-1.5 max-w-[52ch] text-[14px] leading-relaxed"
                      style={{ color: "#525252" }}
                    >
                      {d.body}
                    </p>
                  </div>
                </div>
              ))}
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
            Stop guessing who left.
            <br />
            <span className="ls-hl px-2">Start naming them.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[48ch] text-[15px] leading-relaxed" style={{ color: "#525252" }}>
            Run the calculator above, then see the pixel resolve real names
            and emails on a 15-minute call.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#calculator"
              className="inline-flex items-center justify-center px-6 py-3 text-[14px] font-semibold transition-colors"
              style={{ backgroundColor: "#0f62fe", color: "#ffffff", borderRadius: 2 }}
            >
              Run the calculator
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

      <BookCallCta subtitle="See the pixel put real names on your traffic" />
    </div>
  );
}
