"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import {
  PROPERTY_BRACKETS,
  SELF_SERVE_PROPERTY_CAP,
  computeGraduatedMonthlyCents,
  effectivePerPropertyCents,
} from "@/lib/billing/catalog";
import { PLAN_DISPLAY } from "./plan-display";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// ---------------------------------------------------------------------------
// PricingTiers — the three published plans plus an Enterprise tile.
// Names + prices come from lib/billing/catalog.ts via PLAN_DISPLAY so
// this grid and the ComparisonTable below it can never drift. Design
// rules (Carbon-forward, 2026-07-09):
//
//   1. The middle tier (Growth) gets the visual emphasis — that's where
//      Adam wants 60-70% of customers to land. Emphasis = a flat brand
//      border + "Most popular" eyebrow. No glow, no halo.
//   2. Per-property pricing is the headline number. The yearly toggle
//      shows the 17% prepay discount as a calm savings line — never
//      flashy, never percentage-shaming the monthly choice.
//
// CTA honesty rule: the plan buttons create an account (they navigate
// to /sign-up with plan intent). They are plain links and never claim
// to start a checkout — nothing here talks to Stripe.
// ---------------------------------------------------------------------------

type BillingCycle = "monthly" | "annual";

type Tier = {
  id: "foundation" | "growth" | "scale" | "enterprise";
  // `checkoutTierId` is the catalog id (matches `getTierById()` keys on
  // the server). null means this card books an intro call instead of
  // linking to account creation.
  checkoutTierId: "starter" | "growth" | "scale" | null;
  name: string;
  tagline: string;
  monthly: number | null; // null for Enterprise
  annual: number | null; // monthly-equivalent of the annual prepay
  setupFee: number | null;
  highlighted: boolean;
  ctaLabel: string;
  features: Array<{ label: string; emphasis?: boolean }>;
  audienceCallout: string;
};

const TIERS: Tier[] = [
  {
    id: "foundation",
    checkoutTierId: "starter",
    name: PLAN_DISPLAY.foundation.name,
    tagline: "Free 14-day trial. We connect to your stack and show you what we see.",
    // The public card leads with the free 14-day trial (no card), so the
    // headline price is $0; PLAN_DISPLAY.foundation carries the catalog
    // post-trial rate for surfaces that need it.
    monthly: 0,
    annual: 0,
    setupFee: null,
    highlighted: false,
    ctaLabel: "Request pilot",
    audienceCallout: "Operators evaluating LeaseStack on a single property",
    features: [
      { label: "14-day trial window" },
      { label: "Connect to your existing PMS, ad accounts, and site" },
      { label: "Full read on what your digital marketing is actually doing" },
      { label: "Weekly snapshot of spend, traffic, and lead source mix" },
      { label: "One operator-written recommendation on what to fix first" },
      { label: "AI leasing chatbot trained on your listings" },
      { label: "Reputation monitoring (Google, Reddit, open web)" },
      { label: "No commitment, no card, month-to-month" },
    ],
  },
  {
    id: "growth",
    checkoutTierId: "growth",
    name: PLAN_DISPLAY.growth.name,
    tagline: "Replace your retainer. Flexible, month-to-month.",
    monthly: PLAN_DISPLAY.growth.monthlyDollars,
    annual: PLAN_DISPLAY.growth.annualDollars,
    setupFee: null,
    highlighted: true,
    ctaLabel: `Start with ${PLAN_DISPLAY.growth.name}`,
    audienceCallout: "Single-property operators running a paid program today",
    features: [
      { label: "Everything in Foundation, plus:" },
      {
        label: "Visitor pixel, 5,000 identified visitors per month",
        emphasis: true,
      },
      {
        label: "Spend and performance recommendations across Google and Meta",
        emphasis: true,
      },
      { label: "AI chatbot at 5,000 conversations per month" },
      { label: "Source-to-lease attribution with GSC and GA4" },
      { label: "Operator-written weekly read on every channel" },
      { label: "Flexible, month-to-month." },
    ],
  },
  {
    id: "scale",
    checkoutTierId: "scale",
    name: PLAN_DISPLAY.scale.name,
    tagline: "Per-property pricing with a portfolio rollup and operator success.",
    monthly: PLAN_DISPLAY.scale.monthlyDollars,
    annual: PLAN_DISPLAY.scale.annualDollars,
    setupFee: null,
    highlighted: false,
    ctaLabel: `Start with ${PLAN_DISPLAY.scale.name}`,
    audienceCallout: "Owners and asset managers running 5 or more properties",
    features: [
      { label: "Everything in Growth, plus:" },
      {
        label: "Per-property pricing with a portfolio-level rollup",
        emphasis: true,
      },
      {
        label: "Dedicated operator success contact, not a CSM",
        emphasis: true,
      },
      { label: "Visitor pixel at 25,000 identified visitors per month" },
      { label: "Unlimited AI chatbot conversations" },
      { label: "Audience sync to Meta, Google, and TikTok" },
      { label: "Scheduled reports formatted for asset reviews" },
    ],
  },
  {
    id: "enterprise",
    checkoutTierId: null,
    name: "Enterprise",
    tagline: "Custom integrations and volume pricing for multi-brand owners.",
    monthly: null,
    annual: null,
    setupFee: null,
    highlighted: false,
    ctaLabel: "Book intro call",
    audienceCallout: "20+ properties or multi-brand owners",
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
    <section style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24">
        {/* CEO brief (2026-05-28): the hero already owns the "start free
            trial / book a demo" conversion moment, so the previous
            standalone "Start with the pilot" centered block + the
            "Pre-packaged pricing" eyebrow + the "Still exploring..."
            link have been pulled. The tiers section opens directly with
            the controls that affect what the cards display: property
            count and billing cycle, on a single centered row, no
            separating eyebrow. */}

        {/* Property counter + billing-cycle toggle, one tight row. */}
        <div className="flex flex-col items-center gap-3 mb-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Property-count stepper. Pricing is per-property; cards
                below update in real time. */}
            <div
              className="inline-flex items-center gap-3 rounded-full"
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid var(--hair)",
                padding: "6px 8px",
              }}
            >
              <button
                type="button"
                onClick={() => setPropertyCount((n) => Math.max(1, n - 1))}
                disabled={propertyCount <= 1}
                aria-label="Decrease property count"
                className="inline-flex items-center justify-center rounded-full text-base font-semibold transition-colors disabled:opacity-30"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: "#FFFFFF",
                  color: "#1E2A3A",
                }}
              >
                −
              </button>
              <div
                className="text-center tabular-nums"
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  fontWeight: 600,
                  minWidth: "120px",
                }}
              >
                {propertyCount}{" "}
                <span style={{ color: "var(--stone-gray)", fontWeight: 500 }}>
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
                  backgroundColor: "#FFFFFF",
                  color: "#1E2A3A",
                }}
              >
                +
              </button>
            </div>

            {/* Billing cycle toggle */}
            <div
              role="tablist"
              aria-label="Billing cycle"
              className="inline-flex items-center p-1 rounded-full"
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid var(--hair)",
                boxShadow: "var(--shadow-xs)",
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
                      backgroundColor: active ? "#1E2A3A" : "transparent",
                      color: active ? "#ffffff" : "var(--olive-gray)",
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    <span>{c === "monthly" ? "Monthly" : "Annual"}</span>
                    {c === "annual" ? (
                      <span
                        className="inline-flex items-center rounded-full px-1.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: active
                            ? "rgba(255,255,255,0.16)"
                            : "var(--brand-soft)",
                          color: active ? "#ffffff" : "var(--color-primary)",
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

          {propertyCount > 1 ? (
            <p
              className="text-center"
              style={{
                color: "var(--color-primary)",
                fontFamily: "var(--font-sans)",
                fontSize: "12.5px",
                fontWeight: 500,
                maxWidth: "440px",
              }}
            >
              {(() => {
                const activeBracket =
                  PROPERTY_BRACKETS.find(
                    (b) => propertyCount <= (b.upTo ?? Infinity),
                  ) ?? PROPERTY_BRACKETS[PROPERTY_BRACKETS.length - 1]!;
                const discountPct = Math.round(
                  activeBracket.discountPct * 100,
                );
                if (discountPct === 0) {
                  return "Add more properties to see graduated discounts up to 40 percent off.";
                }
                return `You're saving ${discountPct} percent on properties in this bracket. Add more to reach the next tier.`;
              })()}
            </p>
          ) : null}
          {propertyCount >= MAX_PROPERTIES_STEPPER ? (
            <p
              className="text-center"
              style={{
                color: "var(--stone-gray)",
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                maxWidth: "440px",
              }}
            >
              Self-serve plans cap at {MAX_PROPERTIES_STEPPER} properties.
              For larger portfolios{" "}
              <BookDemoLink
                style={{
                  color: "var(--color-primary)",
                  textDecoration: "underline",
                  textUnderlineOffset: "2px",
                }}
                ariaLabel="Book intro call for volume pricing"
              >
                book an intro call
              </BookDemoLink>{" "}
              for volume pricing.
            </p>
          ) : null}
        </div>

        {/* Tier grid — 4 columns at desktop. The first three (Foundation,
            Growth, Scale) get equal visual weight; Growth is highlighted.
            Enterprise sits at the right as a quieter "talk to us" card. */}
        <div className="mt-10 md:mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
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
            color: "var(--stone-gray)",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            lineHeight: 1.5,
            maxWidth: "780px",
            margin: "32px auto 0",
          }}
        >
          No setup fees. No annual contracts. Additional properties on the
          same plan get 20 percent off the per-property rate. Flexible,
          month-to-month from the billing portal.
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

  // CTA destination — an honest plain link. P1 (launch-critical-sweep):
  // the public pricing CTA is the no-card free trial. Send the prospect
  // to sign-up → onboarding starts their 14-day trial (no Stripe charge
  // yet). This retires anonymous Stripe checkout, which charged
  // customers BEFORE an Organization existed and orphaned the payment.
  // Plan intent is carried so onboarding can preselect.
  const signUpHref = tier.checkoutTierId
    ? `/sign-up?${new URLSearchParams({
        plan: tier.checkoutTierId,
        properties: String(propertyCount),
        cycle,
      }).toString()}`
    : null;

  // Carbon-forward pass — every card is a flat white surface with a
  // hard 1px border and 2px radius. Growth gets the brand border, not
  // a glow halo; elevation reads border-first.
  const cardStyle: React.CSSProperties = highlighted
    ? {
        backgroundColor: "#ffffff",
        color: "#1E2A3A",
        border: "1px solid var(--color-primary)",
        borderRadius: "2px",
        boxShadow: "var(--shadow-xs)",
      }
    : {
        backgroundColor: "#ffffff",
        color: "#1E2A3A",
        border: "1px solid var(--hair)",
        borderRadius: "2px",
        boxShadow: "var(--shadow-xs)",
      };

  const mutedText = "var(--stone-gray)";
  const bodyText = "#1E2A3A";
  const accentText = "var(--color-primary)";

  return (
    <div
      className="relative p-7 md:p-8 flex flex-col"
      style={cardStyle}
    >
      {highlighted ? (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full px-2.5 py-1"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "#ffffff",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Most popular
        </div>
      ) : null}

      {/* Header — tier name is the headline now (text-2xl semibold,
          matching homepage capability headlines) instead of a tiny
          mono uppercase label that read as a footer chip. */}
      <div className="mb-5">
        <h3
          className="text-2xl font-semibold"
          style={{
            color: bodyText,
            fontFamily: "var(--font-sans)",
            letterSpacing: "-0.015em",
            lineHeight: 1.2,
          }}
        >
          {tier.name}
        </h3>
        <p
          className="mt-2"
          style={{
            color: "var(--olive-gray)",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            lineHeight: 1.5,
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
        {basePrice === 0 ? (
          <div>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "44px",
                fontWeight: 700,
                letterSpacing: "-0.026em",
                lineHeight: 1,
              }}
            >
              Free
            </div>
            <p
              className="mt-1"
              style={{
                color: mutedText,
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
              }}
            >
              No card, no commitment
            </p>
          </div>
        ) : basePrice == null || totalMonthly == null ? (
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

      {/* Feature list. flex-1 lets the list expand so every card's CTA
          row lands on the same horizontal line via the `mt-auto` below
          (CEO brief 2026-05-28). */}
      <ul className="space-y-2.5 flex-1">
        {tier.features.map((f, idx) => {
          const isContinuation = f.label.startsWith("Everything in");
          return (
            <li
              key={idx}
              className="flex items-start gap-2"
              style={{
                color: isContinuation ? mutedText : bodyText,
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
                  style={{ color: "var(--color-primary)" }}
                  aria-hidden="true"
                />
              )}
              <span>{f.label}</span>
            </li>
          );
        })}
      </ul>

      {/* CTA. `mt-auto` parks the button at the bottom of the flex
          column so every card's button aligns horizontally regardless
          of feature-list length. The three published plans are honest
          links to account creation (sign-up → onboarding starts the
          trial on that plan); Enterprise books an intro call via
          BookDemoLink. Nothing here claims to start a checkout. */}
      {signUpHref ? (
        <div className="mt-auto pt-6 flex flex-col items-stretch">
          <Link
            href={signUpHref}
            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors"
            style={
              highlighted
                ? { backgroundColor: "var(--color-primary)", color: "#ffffff" }
                : { backgroundColor: "#1E2A3A", color: "#ffffff" }
            }
            aria-label={`${tier.ctaLabel} (creates your account)`}
          >
            {tier.ctaLabel}
          </Link>
          <span
            className="mt-2 text-center"
            style={{
              color: mutedText,
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
            }}
          >
            Creates your account. No card required.
          </span>
        </div>
      ) : (
        <div className="mt-auto pt-6 flex flex-col items-stretch">
          <BookDemoLink
            className="inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "transparent",
              color: "#1E2A3A",
              border: "1px solid #1E2A3A",
            }}
            ariaLabel={`${tier.ctaLabel} (opens scheduling)`}
          >
            {tier.ctaLabel}
          </BookDemoLink>
        </div>
      )}
    </div>
  );
}
