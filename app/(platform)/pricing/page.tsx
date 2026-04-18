import type { Metadata } from "next";
import Link from "next/link";
import { MARKETING } from "@/lib/copy/marketing";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Pricing, ${BRAND_NAME}`,
  description: MARKETING.pricing.subhead,
};

export default function PricingPage() {
  const { pricing } = MARKETING;
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <Header pricing={pricing} />
      <Tiers pricing={pricing} />
      <Addons pricing={pricing} />
      <BuildFees pricing={pricing} />
      <Faq pricing={pricing} />
      <FinalCta />
    </div>
  );
}

function Header({ pricing }: { pricing: typeof MARKETING.pricing }) {
  return (
    <section
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-24 pb-14 text-center">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
          style={{ color: "var(--text-muted)" }}
        >
          {pricing.eyebrow}
        </p>
        <h1
          className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.05]"
          style={{ color: "var(--text-headline)" }}
        >
          {pricing.heading}
        </h1>
        <p
          className="mt-5 font-mono text-sm md:text-base leading-relaxed max-w-2xl mx-auto"
          style={{ color: "var(--text-body)" }}
        >
          {pricing.subhead}
        </p>
      </div>
    </section>
  );
}

function Tiers({ pricing }: { pricing: typeof MARKETING.pricing }) {
  return (
    <section>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {pricing.tiers.map((tier) => (
            <TierCard key={tier.name} tier={tier} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TierCard({
  tier,
}: {
  tier: (typeof MARKETING.pricing.tiers)[number];
}) {
  const isHighlighted = tier.highlight;
  return (
    <article
      className="relative p-7 md:p-8 transition-all"
      style={{
        backgroundColor: isHighlighted
          ? "var(--bg-blue-dark)"
          : "var(--bg-white)",
        border: isHighlighted
          ? "1px solid var(--bg-blue-dark)"
          : "1px solid var(--border-strong)",
        borderRadius: "14px",
        color: isHighlighted ? "white" : "var(--text-body)",
      }}
    >
      {isHighlighted ? (
        <span
          className="absolute -top-3 left-7 font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-1"
          style={{
            backgroundColor: "#FACC15",
            color: "var(--bg-blue-dark)",
            borderRadius: "999px",
          }}
        >
          Most chosen
        </span>
      ) : null}

      <p
        className="font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ opacity: isHighlighted ? 0.7 : 0.6 }}
      >
        {tier.name}
      </p>
      <p
        className="font-serif font-normal mt-3"
        style={{
          fontSize: "44px",
          lineHeight: 1,
          color: isHighlighted ? "white" : "var(--text-headline)",
        }}
      >
        ${tier.price.toLocaleString()}
        <span
          className="font-mono text-base ml-1"
          style={{ opacity: isHighlighted ? 0.7 : 0.6 }}
        >
          {tier.cadence}
        </span>
      </p>
      <p
        className="font-mono text-xs mt-4 leading-relaxed"
        style={{ opacity: isHighlighted ? 0.85 : 0.8 }}
      >
        {tier.tagline}
      </p>

      <ul className="mt-7 space-y-3 text-sm">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-[8px] block flex-shrink-0"
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "999px",
                backgroundColor: isHighlighted
                  ? "rgba(255,255,255,0.7)"
                  : "var(--blue)",
              }}
            />
            <span
              className="leading-snug"
              style={{
                color: isHighlighted ? "rgba(255,255,255,0.92)" : "var(--text-body)",
              }}
            >
              {f}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={tier.ctaHref}
        className="mt-8 block text-center font-mono text-xs font-semibold px-4 py-3.5 rounded"
        style={{
          backgroundColor: isHighlighted ? "white" : "var(--blue)",
          color: isHighlighted ? "var(--bg-blue-dark)" : "white",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Book a demo
      </Link>
    </article>
  );
}

function Addons({ pricing }: { pricing: typeof MARKETING.pricing }) {
  return (
    <section
      style={{
        backgroundColor: "var(--blue-light)",
        borderTop: "1px solid var(--blue-border)",
        borderBottom: "1px solid var(--blue-border)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-16">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
          style={{ color: "var(--blue)" }}
        >
          Add-ons
        </p>
        <h2
          className="font-serif text-2xl md:text-3xl font-normal max-w-2xl"
          style={{ color: "var(--text-headline)" }}
        >
          Stack these on any tier.
        </h2>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          {pricing.addons.map((a) => (
            <div
              key={a.name}
              className="p-6 bg-white"
              style={{
                border: "1px solid var(--border-strong)",
                borderRadius: "12px",
              }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3
                  className="font-serif text-lg font-semibold"
                  style={{ color: "var(--text-headline)" }}
                >
                  {a.name}
                </h3>
                <span
                  className="font-mono text-sm"
                  style={{ color: "var(--text-headline)" }}
                >
                  ${a.price.toLocaleString()}
                  <span style={{ color: "var(--text-muted)" }}>
                    {a.cadence}
                  </span>
                </span>
              </div>
              <p
                className="font-mono text-xs mt-3 leading-relaxed"
                style={{ color: "var(--text-body)" }}
              >
                {a.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BuildFees({ pricing }: { pricing: typeof MARKETING.pricing }) {
  return (
    <section>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-16">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          Build fees
        </p>
        <h2
          className="font-serif text-2xl md:text-3xl font-normal"
          style={{ color: "var(--text-headline)" }}
        >
          {pricing.buildFees.heading}.
        </h2>
        <p
          className="font-mono text-sm leading-relaxed mt-5 max-w-2xl"
          style={{ color: "var(--text-body)" }}
        >
          {pricing.buildFees.body}
        </p>
      </div>
    </section>
  );
}

function Faq({ pricing }: { pricing: typeof MARKETING.pricing }) {
  return (
    <section>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-16">
        <p
          className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          FAQ
        </p>
        <h2
          className="font-serif text-2xl md:text-3xl font-normal"
          style={{ color: "var(--text-headline)" }}
        >
          The questions we get on every call.
        </h2>
        <dl className="mt-10 space-y-3">
          {pricing.faq.map((row) => (
            <details
              key={row.q}
              className="p-5 bg-white group"
              style={{
                border: "1px solid var(--border-strong)",
                borderRadius: "10px",
              }}
            >
              <summary
                className="cursor-pointer font-serif text-base font-semibold flex items-center justify-between"
                style={{ color: "var(--text-headline)" }}
              >
                {row.q}
                <span
                  className="font-mono text-xl transition-transform group-open:rotate-45"
                  style={{ color: "var(--text-muted)" }}
                >
                  +
                </span>
              </summary>
              <p
                className="font-mono text-xs mt-4 leading-relaxed"
                style={{ color: "var(--text-body)" }}
              >
                {row.a}
              </p>
            </details>
          ))}
        </dl>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-16">
        <div
          className="p-10 md:p-14 text-center"
          style={{
            backgroundColor: "var(--bg-blue-dark)",
            borderRadius: "16px",
            color: "white",
          }}
        >
          <h2 className="font-serif text-3xl md:text-4xl font-normal">
            Still deciding?
          </h2>
          <p
            className="font-mono text-sm leading-relaxed mt-4 max-w-xl mx-auto"
            style={{ opacity: 0.85 }}
          >
            Bring your current marketing invoice. We audit it live on the call,
            then show you a proposal within 24 hours.
          </p>
          <Link
            href="/onboarding"
            className="mt-8 inline-block font-mono text-xs font-semibold px-6 py-4 rounded"
            style={{
              backgroundColor: "white",
              color: "var(--bg-blue-dark)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Book a demo
          </Link>
        </div>
      </div>
    </section>
  );
}
