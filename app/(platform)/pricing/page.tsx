import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

// Pricing is scoped on the call — every operator's stack, property count, and
// paid-spend profile is different. Rather than print a rate card that boxes
// every prospect in, the "pricing" URL is kept as a soft landing that answers
// the question and routes to a conversation.

export const metadata: Metadata = {
  title: `Pricing, ${BRAND_NAME}`,
  description:
    "Every engagement is a build plus monthly retainer, scoped to your portfolio on a 20-minute call. No long contracts.",
};

export default function PricingPage() {
  return (
    <div style={{ backgroundColor: "#f5f4ed", color: "#4d4c48" }}>
      <section style={{ backgroundColor: "#f5f4ed" }}>
        <div className="max-w-[820px] mx-auto px-4 md:px-8 pt-24 md:pt-32 pb-12 md:pb-16 text-center">
          <p className="eyebrow mb-6">Pricing</p>
          <h1
            className="mx-auto"
            style={{
              color: "#141413",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(40px, 5vw, 60px)",
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.005em",
            }}
          >
            Scoped on the call. No contracts.
          </h1>
          <p
            className="mx-auto mt-6"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              lineHeight: 1.6,
              color: "#5e5d59",
              maxWidth: "620px",
            }}
          >
            Every operator&apos;s stack is different. Portfolio size, current
            vendors, ad spend, PMS, the vertical you&apos;re in. We bring a
            proposal within 24 hours of a 20-minute call, with a fixed build
            fee and a flat monthly retainer. Month-to-month after launch.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/onboarding" className="btn-primary">
              Book a demo
            </Link>
            <Link href="/#live" className="btn-secondary">
              See it live
            </Link>
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
        <div className="max-w-[980px] mx-auto px-4 md:px-8 py-20 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ProposalBlock
              label="What we scope"
              body="Build fee covers the custom site, domain migration, PMS + pixel + chatbot wiring, SEO + AEO pages, initial creative. Retainer covers managed operations thereafter."
            />
            <ProposalBlock
              label="What shapes the number"
              body="Portfolio size, integrations required, whether you want ads managed, vertical-specific compliance work, and whether you're migrating off an existing stack."
            />
            <ProposalBlock
              label="What doesn't change"
              body="No long contracts. Month-to-month after launch. If we don't move lease velocity, you cancel."
            />
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-28 text-center">
          <p
            className="mb-6"
            style={{
              color: "#2F6FE5",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            The call
          </p>
          <h2
            className="mx-auto max-w-[780px]"
            style={{
              color: "#141413",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 500,
              lineHeight: 1.12,
              letterSpacing: "-0.008em",
            }}
          >
            Bring your current marketing invoice. We audit it live.
          </h2>
          <p
            className="mx-auto mt-5 max-w-[560px]"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            Twenty minutes. Proposal within 24 hours with a fixed build fee and flat monthly retainer.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/onboarding" className="btn-primary">
              Book a demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProposalBlock({ label, body }: { label: string; body: string }) {
  return (
    <div
      className="p-7"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #f0eee6",
      }}
    >
      <p
        style={{
          color: "#87867f",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      <p
        className="mt-3"
        style={{
          color: "#141413",
          fontFamily: "var(--font-sans)",
          fontSize: "16px",
          lineHeight: 1.6,
        }}
      >
        {body}
      </p>
    </div>
  );
}
