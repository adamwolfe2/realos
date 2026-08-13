import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import { DemoQualifyWizard } from "@/components/marketing/demo-qualify-wizard";

// ---------------------------------------------------------------------------
// /book-demo — qualification-first demo booking.
//
// Every "Book a demo" CTA on the marketing site lands here (see
// lib/marketing/book-demo.ts). Three steps: contact info → feature
// interests → inline Cal.com booking on Norman's calendar. The intake
// row is written before the booking step, so the lead + their priorities
// are captured even if they bail on scheduling.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Book a demo | ${BRAND_NAME}`,
  description:
    "Tell us about your property and what you want fixed — then pick a time. 15 minutes, we come prepared.",
  alternates: { canonical: "/book-demo" },
  robots: { index: true, follow: true },
};

export default function BookDemoPage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <section className="relative">
        <div className="mx-auto max-w-[720px] px-4 pb-20 pt-20 md:px-8 md:pt-24">
          <div className="mb-10 text-center">
            <p
              className="mb-4 text-[11px] font-mono uppercase tracking-[0.18em]"
              style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
            >
              Book a demo
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 4.6vw, 46px)",
                fontWeight: 550,
                lineHeight: 1.08,
                letterSpacing: "-0.03em",
              }}
            >
              A 15-minute demo, built around{" "}
              <span className="ls-hl px-2">your property.</span>
            </h1>
            <p
              className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-relaxed"
              style={{ color: "#525252" }}
            >
              Two quick questions so we can pull your market and your numbers
              before the call. Then pick any time that works.
            </p>
          </div>
          <DemoQualifyWizard />
        </div>
      </section>
    </div>
  );
}
