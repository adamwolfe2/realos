import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TIERS } from "@/lib/billing/catalog";

// ---------------------------------------------------------------------------
// Pricing teaser — three tier names, three numbers, one link to /pricing.
// Apple-clean: short and quiet, the heavy lifting happens on the pricing
// page itself.
// ---------------------------------------------------------------------------

export function LandingPricingTeaser() {
  const cards = TIERS.map((t) => ({
    id: t.id,
    name: t.productName.replace(/^LeaseStack\s+/, ""),
    monthly: Math.round(t.monthly.unitAmountCents / 100),
    description: t.productDescription.split(".")[0] + ".",
  }));

  return (
    <section style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-[1080px] mx-auto px-6 md:px-8 py-24 md:py-32">
        <div className="max-w-2xl mb-16 md:mb-20">
          <p className="eyebrow mb-4">Pricing</p>
          <h2
            style={{
              color: "#0B1220",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(32px, 4.5vw, 48px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.022em",
            }}
          >
            Pick a tier.
            <br />
            <span style={{ color: "#2563EB" }}>Add what you need.</span>
          </h2>
          <p
            className="mt-5"
            style={{
              color: "#475569",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.55,
            }}
          >
            Per-property, month-to-month. Graduated discounts kick in
            automatically as your portfolio grows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {cards.map((c, i) => (
            <div
              key={c.id}
              className="rounded-2xl"
              style={{
                backgroundColor: "#FFFFFF",
                border: i === 1 ? "1px solid #2563EB" : "1px solid #E2E8F0",
                padding: "28px 28px 28px",
                boxShadow:
                  i === 1
                    ? "0 0 0 4px rgba(37,99,235,0.06)"
                    : "0 1px 2px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  color: "#94A3B8",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {c.name}
              </div>
              <div className="flex items-baseline gap-1.5 mt-4">
                <span
                  style={{
                    color: "#0B1220",
                    fontFamily: "var(--font-sans)",
                    fontSize: "44px",
                    fontWeight: 700,
                    letterSpacing: "-0.028em",
                    lineHeight: 1,
                  }}
                >
                  ${c.monthly.toLocaleString()}
                </span>
                <span
                  style={{
                    color: "#94A3B8",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                  }}
                >
                  /mo
                </span>
              </div>
              <p
                className="mt-4"
                style={{
                  color: "#475569",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14.5px",
                  lineHeight: 1.55,
                }}
              >
                {c.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 transition-colors"
            style={{
              color: "#0B1220",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              fontWeight: 600,
              borderBottom: "1px solid #0B1220",
              paddingBottom: "2px",
            }}
          >
            See full pricing and add-ons
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
