"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  PROPERTY_BRACKETS,
  SELF_SERVE_PROPERTY_CAP,
  computeGraduatedMonthlyCents,
  effectivePerPropertyCents,
} from "@/lib/billing/catalog";

// ---------------------------------------------------------------------------
// PricingTiers — the three published plans (Foundation, Growth, Scale) plus
// an Enterprise tile. Two design rules:
//
//   1. The middle tier (Growth) gets the visual emphasis — that's where
//      Adam wants 60-70% of customers to land. We elevate it with a
//      darker card, the blue accent ring, and a "Most popular" eyebrow.
//   2. Per-property pricing is the headline number. The yearly toggle
//      shows the 17% prepay discount as a calm savings line — never
//      flashy, never percentage-shaming the monthly choice.
//
// Setup fees + ad-spend markup are surfaced beneath each card so the
// total cost picture is honest, not buried.
// ---------------------------------------------------------------------------

type BillingCycle = "monthly" | "annual";

type Tier = {
  id: "foundation" | "growth" | "scale" | "enterprise";
  // `checkoutTierId` is the catalog id (matches `getTierById()` keys on
  // the server). null means this card goes to /demo instead of starting
  // a Checkout session.
  checkoutTierId: "starter" | "growth" | "scale" | null;
  name: string;
  tagline: string;
  monthly: number | null; // null for Enterprise
  annual: number | null; // monthly-equivalent of the annual prepay
  setupFee: number | null;
  highlighted: boolean;
  ctaLabel: string;
  ctaHref: string;
  features: Array<{ label: string; emphasis?: boolean }>;
  audienceCallout: string;
};

const TIERS: Tier[] = [
  {
    id: "foundation",
    checkoutTierId: "starter",
    name: "Foundation",
    tagline: "The core platform for a single property.",
    monthly: 499,
    annual: 419,
    setupFee: null,
    highlighted: false,
    ctaLabel: "Start with Foundation",
    ctaHref: "/onboarding?plan=foundation",
    audienceCallout: "Owner-operators with 1 to 2 properties",
    features: [
      { label: "Marketing site builder, hosted on your domain" },
      { label: "Live AppFolio listings sync" },
      { label: "AI leasing chatbot, 1,000 conversations per month" },
      { label: "Lead capture and tour scheduling" },
      { label: "Multi-property CRM" },
      { label: "Reputation monitoring (Google, Reddit, open web)" },
      { label: "Standard reports and monthly email digest" },
    ],
  },
  {
    id: "growth",
    checkoutTierId: "growth",
    name: "Growth",
    tagline: "Add paid acquisition, attribution, and SEO.",
    monthly: 899,
    annual: 749,
    setupFee: null,
    highlighted: true,
    ctaLabel: "Start with Growth",
    ctaHref: "/onboarding?plan=growth",
    audienceCallout: "Mid-market operators running paid campaigns",
    features: [
      { label: "Everything in Foundation, plus:" },
      {
        label: "Cursive visitor pixel, 5,000 identified visitors per month",
        emphasis: true,
      },
      {
        label: "Google and Meta ad campaign builder",
        emphasis: true,
      },
      { label: "AI chatbot bumped to 5,000 conversations per month" },
      { label: "SEO module with GSC and GA4 integration" },
      { label: "Creative library and brand kit" },
      { label: "Multi-touch attribution and funnel reports" },
    ],
  },
  {
    id: "scale",
    checkoutTierId: "scale",
    name: "Scale",
    tagline: "Audience sync, outbound, and unlimited chatbot.",
    monthly: 1499,
    annual: 1249,
    setupFee: null,
    highlighted: false,
    ctaLabel: "Start with Scale",
    ctaHref: "/onboarding?plan=scale",
    audienceCallout: "Portfolio operators with 5 or more properties",
    features: [
      { label: "Everything in Growth, plus:" },
      {
        label: "Cursive pixel bumped to 25,000 identified visitors per month",
        emphasis: true,
      },
      {
        label: "Audience builder with sync to Meta, Google, and TikTok",
        emphasis: true,
      },
      { label: "Unlimited AI chatbot conversations" },
      { label: "Outbound email, 3,000 sends per month" },
      { label: "Resident referral program" },
      { label: "Scheduled custom reports" },
    ],
  },
  {
    id: "enterprise",
    checkoutTierId: null,
    name: "Enterprise",
    tagline: "Custom integrations and volume pricing.",
    monthly: null,
    annual: null,
    setupFee: null,
    highlighted: false,
    ctaLabel: "Talk to sales",
    ctaHref: "/demo?plan=enterprise",
    audienceCallout: "20+ properties or multi-brand operators",
    features: [
      { label: "Everything in Scale, plus:" },
      { label: "Volume pricing (25 to 35 percent off list)" },
      { label: "White-label workspace included" },
      { label: "Custom PMS integrations (non-AppFolio)" },
      { label: "SSO and SCIM provisioning" },
      { label: "Custom data retention and exports" },
      { label: "Annual and multi-year terms available" },
    ],
  },
];

// Hard cap on the property-count stepper. Anything bigger routes to
// the Enterprise tier (which talks to sales). Matches
// SELF_SERVE_PROPERTY_CAP in lib/billing/catalog.ts so the UI never
// quotes a price the checkout endpoint would reject.
const MAX_PROPERTIES_STEPPER = SELF_SERVE_PROPERTY_CAP;

export function PricingTiers() {
  const [cycle, setCycle] = React.useState<BillingCycle>("monthly");
  const [propertyCount, setPropertyCount] = React.useState<number>(1);

  return (
    <section style={{ backgroundColor: "#f5f4ed" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 pb-16 md:pb-20">
        {/* Property-count stepper. Pricing is per-property so we let the
            buyer dial in their portfolio size right here; every tier
            card below updates its monthly total in real time. Additional
            properties past the first get 20 percent off via the
            additional-property prices in lib/billing/catalog.ts. */}
        <div className="flex flex-col items-center mb-6 md:mb-8">
          <p
            className="eyebrow mb-3"
            style={{ letterSpacing: "0.16em", color: "#88867f" }}
          >
            How many properties or locations?
          </p>
          <div
            className="inline-flex items-center gap-3 rounded-full"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e8e6dc",
              padding: "6px 8px",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setPropertyCount((n) => Math.max(1, n - 1))
              }
              disabled={propertyCount <= 1}
              aria-label="Decrease property count"
              className="inline-flex items-center justify-center rounded-full text-base font-semibold transition-colors disabled:opacity-30"
              style={{
                width: 32,
                height: 32,
                backgroundColor: "#f5f4ed",
                color: "#141413",
              }}
            >
              −
            </button>
            <div
              className="text-center tabular-nums"
              style={{
                color: "#141413",
                fontFamily: "var(--font-sans)",
                fontSize: "16px",
                fontWeight: 600,
                minWidth: "120px",
              }}
            >
              {propertyCount}{" "}
              <span style={{ color: "#88867f", fontWeight: 500 }}>
                {propertyCount === 1 ? "property" : "properties"}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setPropertyCount((n) =>
                  Math.min(MAX_PROPERTIES_STEPPER, n + 1),
                )
              }
              disabled={propertyCount >= MAX_PROPERTIES_STEPPER}
              aria-label="Increase property count"
              className="inline-flex items-center justify-center rounded-full text-base font-semibold transition-colors disabled:opacity-30"
              style={{
                width: 32,
                height: 32,
                backgroundColor: "#f5f4ed",
                color: "#141413",
              }}
            >
              +
            </button>
          </div>
          {propertyCount > 1 ? (
            <p
              className="mt-2 text-center"
              style={{
                color: "#2563EB",
                fontFamily: "var(--font-sans)",
                fontSize: "12.5px",
                fontWeight: 500,
                maxWidth: "440px",
              }}
            >
              {(() => {
                // Friendly summary of which bracket they're in. The
                // discount label always describes where the NEXT
                // property would land, so adding properties feels
                // rewarding.
                const activeBracket =
                  PROPERTY_BRACKETS.find(
                    (b) => propertyCount <= (b.upTo ?? Infinity),
                  ) ?? PROPERTY_BRACKETS[PROPERTY_BRACKETS.length - 1]!;
                const discountPct = Math.round(
                  activeBracket.discountPct * 100,
                );
                if (discountPct === 0) {
                  return "Add more properties to unlock graduated discounts up to 40 percent off.";
                }
                return `You're saving ${discountPct} percent on properties in this bracket. Add more to unlock the next tier.`;
              })()}
            </p>
          ) : null}
          {propertyCount >= MAX_PROPERTIES_STEPPER ? (
            <p
              className="mt-2 text-center"
              style={{
                color: "#88867f",
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                maxWidth: "440px",
              }}
            >
              Self-serve checkout caps at {MAX_PROPERTIES_STEPPER} properties.
              For larger portfolios{" "}
              <Link
                href="/demo?plan=enterprise"
                style={{
                  color: "#2563EB",
                  textDecoration: "underline",
                  textUnderlineOffset: "2px",
                }}
              >
                talk to sales
              </Link>{" "}
              for volume pricing.
            </p>
          ) : null}
        </div>

        {/* Billing cycle toggle */}
        <div className="flex items-center justify-center mb-10 md:mb-12">
          <div
            role="tablist"
            aria-label="Billing cycle"
            className="inline-flex items-center p-1 rounded-full"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e8e6dc",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
          >
            {(["monthly", "annual"] as const).map((c) => {
              const active = cycle === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCycle(c)}
                  className="relative inline-flex items-center gap-2 px-4 py-1.5 text-sm rounded-full transition-colors"
                  style={{
                    backgroundColor: active ? "#141413" : "transparent",
                    color: active ? "#ffffff" : "#5e5d59",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <span>
                    {c === "monthly" ? "Monthly" : "Annual"}
                  </span>
                  {c === "annual" ? (
                    <span
                      className="inline-flex items-center rounded-full px-1.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: active
                          ? "rgba(255,255,255,0.16)"
                          : "rgba(37,99,235,0.08)",
                        color: active ? "#ffffff" : "#2563EB",
                        letterSpacing: "0.02em",
                      }}
                    >
                      Save 17%
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tier grid — 4 columns at desktop. The first three (Foundation,
            Growth, Scale) get equal visual weight; Growth is highlighted.
            Enterprise sits at the right as a quieter "talk to us" card. */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map((t) => (
            <TierCard
              key={t.id}
              tier={t}
              cycle={cycle}
              propertyCount={propertyCount}
            />
          ))}
        </div>

        {/* Sub-card disclosure — keeps the cards clean while still
            making the cost-of-success transparent. */}
        <p
          className="mt-8 text-center"
          style={{
            color: "#88867f",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            lineHeight: 1.5,
            maxWidth: "780px",
            margin: "32px auto 0",
          }}
        >
          No setup fees. No annual contracts. Additional properties on the
          same plan get 20 percent off the per-property rate. Cancel or pause
          anytime from the billing portal.
        </p>
      </div>
    </section>
  );
}

function TierCard({
  tier,
  cycle,
  propertyCount,
}: {
  tier: Tier;
  cycle: BillingCycle;
  propertyCount: number;
}) {
  const basePrice = cycle === "monthly" ? tier.monthly : tier.annual;
  const highlighted = tier.highlighted;
  const [submitting, setSubmitting] = React.useState(false);

  // Compute the effective monthly total using the graduated brackets.
  // Mirrors lib/billing/catalog.ts and the Stripe `billing_scheme:
  // "tiered"` prices created by scripts/stripe-setup.ts. Enterprise
  // (basePrice null) just shows "Custom".
  const totalMonthly =
    basePrice != null
      ? Math.round(
          computeGraduatedMonthlyCents(basePrice * 100, propertyCount) / 100,
        )
      : null;
  const effectivePerProperty =
    basePrice != null && propertyCount > 0
      ? Math.round(
          effectivePerPropertyCents(basePrice * 100, propertyCount) / 100,
        )
      : null;

  // CTA click handler — Enterprise routes to /demo as a plain link; the
  // other three tiers post to /api/billing/checkout to mint a Stripe
  // Checkout session, then window.location to the returned URL. We
  // default to 1 property for the public-pricing-page flow; the
  // onboarding flow lets prospects bump the count after.
  const startCheckout = React.useCallback(async () => {
    if (!tier.checkoutTierId || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: tier.checkoutTierId,
          cycle,
          propertyCount,
          source: "pricing_page",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.url) {
        toast.error(
          body?.error ??
            `Couldn't start checkout (HTTP ${res.status}). Try again in a minute or email hello@leasestack.co.`,
        );
        setSubmitting(false);
        return;
      }
      window.location.assign(body.url as string);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't reach the checkout service. Try again shortly.",
      );
      setSubmitting(false);
    }
  }, [tier.checkoutTierId, cycle, propertyCount, submitting]);

  // Brand pass — every card is a clean white surface. Growth gets a
  // soft blue ring + subtle lift, NOT a dark inversion. Previous black
  // card broke the cream/blue/white palette of the platform.
  const cardStyle: React.CSSProperties = highlighted
    ? {
        backgroundColor: "#ffffff",
        color: "#141413",
        border: "1px solid #2563EB",
        boxShadow:
          "0 0 0 4px rgba(37,99,235,0.08), 0 8px 24px rgba(37,99,235,0.10)",
      }
    : {
        backgroundColor: "#ffffff",
        color: "#141413",
        border: "1px solid #e8e6dc",
        boxShadow: "0 1px 2px rgba(20,20,19,0.02)",
      };

  const mutedText = "#88867f";
  const bodyText = "#4d4c48";
  const accentText = "#2563EB";

  return (
    <div
      className="relative rounded-2xl p-6 md:p-7 flex flex-col"
      style={cardStyle}
    >
      {highlighted ? (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full px-3 py-1"
          style={{
            backgroundColor: "#2563EB",
            color: "#ffffff",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Most popular
        </div>
      ) : null}

      {/* Header */}
      <div className="mb-5">
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: mutedText,
            fontWeight: 600,
          }}
        >
          {tier.name}
        </div>
        <p
          className="mt-1"
          style={{
            color: bodyText,
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            lineHeight: 1.45,
          }}
        >
          {tier.tagline}
        </p>
      </div>

      {/* Price block. Two display modes:
            Single property → "$X /mo per property"
            Multi-property  → big number is the TOTAL across the
                              portfolio; sub-line breaks down base
                              + discounted additional rate.
          Custom (Enterprise) keeps its "Custom" copy unchanged. */}
      <div className="mb-2 min-h-[88px]">
        {basePrice == null || totalMonthly == null ? (
          <div>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "32px",
                fontWeight: 700,
                letterSpacing: "-0.022em",
                lineHeight: 1.05,
              }}
            >
              Custom
            </div>
            <p
              className="mt-1"
              style={{
                color: mutedText,
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
              }}
            >
              Volume-priced
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-1">
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "44px",
                  fontWeight: 700,
                  letterSpacing: "-0.026em",
                  lineHeight: 1,
                }}
              >
                ${totalMonthly.toLocaleString()}
              </span>
              <span
                style={{
                  color: mutedText,
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                /mo
                {propertyCount === 1 ? " · per property" : ""}
              </span>
            </div>
            {propertyCount > 1 && effectivePerProperty != null ? (
              <p
                className="mt-1"
                style={{
                  color: mutedText,
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                }}
              >
                ${effectivePerProperty.toLocaleString()} avg per property ·
                graduated discounts applied
              </p>
            ) : null}
            {cycle === "annual" && tier.monthly && tier.annual != null ? (
              <p
                className="mt-1"
                style={{
                  color: accentText,
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  fontWeight: 500,
                }}
              >
                Billed yearly · save $
                {(() => {
                  // Yearly savings = (monthly total at this property
                  // count) minus (annual-equivalent monthly total at
                  // this property count), multiplied by 12.
                  const monthlyTotal =
                    computeGraduatedMonthlyCents(
                      tier.monthly * 100,
                      propertyCount,
                    ) / 100;
                  const annualMonthlyEquivalent =
                    computeGraduatedMonthlyCents(
                      tier.annual * 100,
                      propertyCount,
                    ) / 100;
                  const saved =
                    (monthlyTotal - annualMonthlyEquivalent) * 12;
                  return Math.round(saved).toLocaleString();
                })()}
                /yr
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Audience callout */}
      <p
        style={{
          color: mutedText,
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: "16px",
        }}
      >
        {tier.audienceCallout}
      </p>

      {/* CTA — Enterprise stays a static link to /demo; everything else
          posts to the Checkout endpoint and forwards to the Stripe-
          hosted Checkout page. We keep the same visual shell so the
          three tier buttons feel identical. */}
      {tier.checkoutTierId ? (
        <button
          type="button"
          onClick={startCheckout}
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-70 disabled:cursor-progress"
          style={
            highlighted
              ? { backgroundColor: "#2563EB", color: "#ffffff" }
              : { backgroundColor: "#141413", color: "#ffffff" }
          }
          aria-label={`Start checkout for ${tier.name} (${cycle})`}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Starting checkout…
            </>
          ) : (
            tier.ctaLabel
          )}
        </button>
      ) : (
        <Link
          href={tier.ctaHref}
          className="inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition-colors"
          style={{
            backgroundColor: "transparent",
            color: "#141413",
            border: "1px solid #141413",
          }}
        >
          {tier.ctaLabel}
        </Link>
      )}

      {/* Feature list */}
      <ul className="mt-6 space-y-2.5 flex-1">
        {tier.features.map((f, idx) => {
          const isContinuation = f.label.startsWith("Everything in");
          return (
            <li
              key={idx}
              className="flex items-start gap-2"
              style={{
                color: isContinuation
                  ? highlighted
                    ? "#bdbcb6"
                    : "#88867f"
                  : bodyText,
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                lineHeight: 1.5,
                fontWeight: f.emphasis ? 600 : 400,
                fontStyle: isContinuation ? "italic" : "normal",
              }}
            >
              {isContinuation ? (
                <span aria-hidden="true" style={{ width: "16px" }}></span>
              ) : (
                <Check
                  className="shrink-0 mt-[3px]"
                  size={14}
                  strokeWidth={2.5}
                  style={{
                    color: highlighted ? "#9ec1ff" : "#2563EB",
                  }}
                  aria-hidden="true"
                />
              )}
              <span>{f.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
