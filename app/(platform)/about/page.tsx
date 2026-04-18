import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `About ${BRAND_NAME}`,
  description: `${BRAND_NAME} is the managed marketing platform for real estate operators. One platform, one retainer, no long contracts.`,
};

export default function AboutPage() {
  return (
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
      <header style={{ borderBottom: "1px solid #f0eee6" }}>
        <div className="max-w-[920px] mx-auto px-4 md:px-8 pt-24 md:pt-28 pb-16 text-center">
          <p
            className="mb-5"
            style={{
              color: "#2F6FE5",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            About {BRAND_NAME}
          </p>
          <h1
            style={{
              color: "#141413",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(36px, 5vw, 60px)",
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.005em",
            }}
          >
            Infrastructure for the
            <br />
            <span style={{ color: "#2F6FE5" }}>independent operator.</span>
          </h1>
          <p
            className="mx-auto mt-6 max-w-[620px]"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              lineHeight: 1.6,
            }}
          >
            {BRAND_NAME} is a managed marketing platform built for independent
            real estate operators. Custom site, live listings, identity pixel,
            AI chatbot, managed ads, follow-up. One retainer, no long contracts.
          </p>
        </div>
      </header>

      <section style={{ backgroundColor: "#faf9f5" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24 grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div>
            <p className="eyebrow mb-4">Why we exist</p>
            <h2
              style={{
                color: "#141413",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(26px, 3vw, 36px)",
                fontWeight: 500,
                lineHeight: 1.2,
              }}
            >
              Independent operators were buying the wrong stack.
            </h2>
            <p
              className="mt-5"
              style={{
                color: "#5e5d59",
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                lineHeight: 1.65,
              }}
            >
              Most operators we spoke with were running five to eight vendors:
              an agency for paid spend, a site no one could edit, a chatbot
              that answered one question, a CRM no team used, a freelance
              designer, and a listing portal pulling its own fee.
            </p>
            <p
              className="mt-4"
              style={{
                color: "#5e5d59",
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                lineHeight: 1.65,
              }}
            >
              National REITs run in-house teams on software that independent
              operators can&apos;t buy off the shelf. We built the off-the-shelf
              version.
            </p>
          </div>
          <div
            className="p-8"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 0 0 1px #f0eee6",
            }}
          >
            <p className="eyebrow mb-5">What we built</p>
            <ul
              className="space-y-3"
              style={{
                color: "#4d4c48",
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                lineHeight: 1.6,
              }}
            >
              <li>Managed site on your custom domain, live listing sync.</li>
              <li>Identity graph pixel on every visit.</li>
              <li>AI chatbot trained on your inventory.</li>
              <li>Google and Meta ads, 48 hour creative turnaround.</li>
              <li>Lead capture, CRM, and automated nurture.</li>
              <li>Per-property dashboard and weekly operator report.</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: "#141413" }}>
        <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-20 md:py-24 text-center">
          <p
            className="mb-6"
            style={{
              color: "#87867f",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Our belief
          </p>
          <p
            className="mx-auto max-w-[780px]"
            style={{
              color: "#faf9f5",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(24px, 3.2vw, 38px)",
              fontWeight: 500,
              lineHeight: 1.3,
            }}
          >
            Operators should spend their time on partnerships, pricing, and
            community. Not on stitching together five vendor dashboards. We do
            the stitching. You run the building.
          </p>
        </div>
      </section>

      <section style={{ backgroundColor: "#f5f4ed" }}>
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-20 text-center">
          <Link href="/onboarding" className="btn-primary">
            Book a demo
          </Link>
        </div>
      </section>
    </div>
  );
}
