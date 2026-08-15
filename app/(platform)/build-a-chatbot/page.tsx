import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { Atmosphere } from "@/components/home/atmosphere";
import { ChatbotBuilder } from "@/components/marketing/chatbot-builder";
import { BookCallCta } from "@/components/audit/book-call-cta";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// ---------------------------------------------------------------------------
// /build-a-chatbot — chatbot lead magnet.
//
// The wow moment IS the page: paste a property website, watch the
// assistant get built, then talk to it live, trained on that site's real
// content. Keeping it costs a name + email (IntakeSubmission via
// /api/onboarding), and the close is Norman's calendar. Same visual
// voice as /ai-visibility: Atmosphere, 550-weight display type, Carbon
// blue, ls-hl marker highlight, mono numerals.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Build your property's AI chatbot, free | ${BRAND_NAME}`,
  description:
    "Paste your property's website and talk to an AI leasing assistant trained on it, live, in about 60 seconds. No account, no card. Keep it with one email.",
  alternates: { canonical: "/build-a-chatbot" },
  robots: { index: true, follow: true },
};

const HOW = [
  {
    n: "01",
    title: "Paste your website",
    body: "We render your public site and pull out what a renter needs: floor plans, amenities, pet policy, parking, application steps.",
  },
  {
    n: "02",
    title: "Talk to it live",
    body: "The assistant answers right here on this page, grounded only in your actual content. Ask it the questions your prospects ask at 2am.",
  },
  {
    n: "03",
    title: "Install with one snippet",
    body: "Keep it and we email you the install snippet. One line of code on any site, then it captures name, email, and tour requests for your team.",
  },
] as const;

export default function BuildAChatbotPage() {
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

        <div className="relative mx-auto max-w-[1100px] px-4 pt-12 md:px-8 md:pt-20">
          <div className="mx-auto max-w-[760px] text-center">
            <p
              className="ls-rise mb-4 text-[11px] font-mono uppercase tracking-[0.18em]"
              style={{ color: "#0f62fe", fontFamily: "var(--font-mono)" }}
            >
              Free chatbot builder
            </p>
            <h1
              className="ls-rise mx-auto"
              style={{
                animationDelay: "80ms",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(34px, 4.8vw, 58px)",
                fontWeight: 550,
                lineHeight: 1.06,
                letterSpacing: "-0.035em",
              }}
            >
              Your property&apos;s leasing agent,
              <br />
              <span className="ls-hl px-2">built in 60 seconds.</span>
            </h1>
            <p
              className="ls-rise mx-auto mt-5 max-w-[46ch] text-[15.5px] leading-relaxed md:text-[16px]"
              style={{ animationDelay: "160ms", color: "#525252" }}
            >
              Paste your website below. We train a leasing assistant on
              what&apos;s actually there, and you talk to it right here.
            </p>
          </div>
        </div>
      </section>

      {/* ── The builder ──────────────────────────────────────────────── */}
      <section className="relative">
        <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-10 md:px-8 md:pb-24 md:pt-12">
          <div className="ls-rise" style={{ animationDelay: "240ms" }}>
            <ChatbotBuilder />
          </div>
        </div>
      </section>

      {/* ── How it works — editorial rows, no card grid ──────────────── */}
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
                From URL to leasing assistant, in three moves.
              </h2>
              <p
                className="mt-4 max-w-[52ch] text-[15px] leading-relaxed"
                style={{ color: "#525252" }}
              >
                The preview on this page runs on the same assistant our
                tenants install. The production version adds your live
                availability, pricing rules, lead routing, and a
                conversation inbox your team actually reads.
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
            Renters ask at 2am.
            <br />
            <span className="ls-hl px-2">It answers.</span>
          </h2>
          <p
            className="mx-auto mt-5 max-w-[48ch] text-[15px] leading-relaxed"
            style={{ color: "#525252" }}
          >
            Build the preview above, then let us install and tune it on a
            15-minute call: live availability, your pricing rules, and every
            captured lead routed to your team.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#builder"
              className="inline-flex items-center justify-center px-6 py-3 text-[14px] font-semibold transition-colors"
              style={{ backgroundColor: "#0f62fe", color: "#ffffff", borderRadius: 2 }}
            >
              Build my chatbot
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

      <BookCallCta subtitle="We'll install and tune your chatbot on a 15-minute call" />
    </div>
  );
}
