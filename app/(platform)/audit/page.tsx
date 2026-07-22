import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { DigitalScoreQuiz } from "@/components/audit/digital-score-quiz";

export const metadata: Metadata = {
  title: `Digital Performance Score | ${BRAND_NAME}`,
  description:
    "Get your free Digital Performance Score for student housing, multifamily, senior, or commercial properties. Real-data benchmarking across findability, reputation, conversion, tracking, accessibility, and listings. With a prioritized action plan.",
  alternates: { canonical: "/audit" },
  robots: { index: true, follow: true },
};

export default function AuditFormPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <section className="relative">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 pt-20 md:pt-24 pb-12 md:pb-24">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-4 md:mb-6">
              <span
                aria-hidden
                className="hidden sm:inline-block"
                style={{ width: 28, height: 1, backgroundColor: "#2563EB" }}
              />
              <p
                className="text-[11px] font-mono uppercase tracking-[0.18em]"
                style={{
                  color: "#2563EB",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Digital Performance Score · 8 questions
              </p>
              <span
                aria-hidden
                className="hidden sm:inline-block"
                style={{ width: 28, height: 1, backgroundColor: "#2563EB" }}
              />
            </div>
            <h1
              className="text-[28px] sm:text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.1] sm:leading-[1.05] tracking-tight"
              style={{ color: "#1E2A3A" }}
            >
              How is your property actually performing online?
            </h1>
            <p
              className="mt-4 sm:mt-5 text-base sm:text-lg md:text-xl leading-relaxed mx-auto max-w-2xl"
              style={{ color: "#4B5563" }}
            >
              Answer 8 quick questions. We scan your SEO, reputation, and
              accessibility, then return a personalized action plan. Free,
              no card.
            </p>
            <div className="mt-6 sm:mt-8 text-left">
              <DigitalScoreQuiz />
            </div>
          </div>

          <ul className="mt-10 md:mt-12 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 max-w-3xl mx-auto">
            <TrustItem
              title="Personalized, not generic"
              body="Your quiz answers fill the gaps a crawler can't see. Chatbot, tracking, intake, listings."
            />
            <TrustItem
              title="6 pillars, real data"
              body="Findability, reputation, conversion, tracking, accessibility, listings. Weighted and scored."
            />
            <TrustItem
              title="Action items, not vibes"
              body="Each finding is tagged 'fix yourself' or 'LeaseStack handles' so you know what to do next."
            />
          </ul>
        </div>
      </section>
    </div>
  );
}

function TrustItem({ title, body }: { title: string; body: string }) {
  return (
    <li
      className="rounded-xl border p-4"
      style={{ borderColor: "#E5E7EB", backgroundColor: "#FBFBFD" }}
    >
      <p className="text-sm font-medium" style={{ color: "#1E2A3A" }}>
        {title}
      </p>
      <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
        {body}
      </p>
    </li>
  );
}
