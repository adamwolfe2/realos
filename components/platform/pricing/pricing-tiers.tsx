"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
    tagline: "Get your marketing engine online.",
    monthly: 599,
    annual: 499,
    setupFee: 1500,
    highlighted: false,
    ctaLabel: "Start with Foundation",
    ctaHref: "/onboarding?plan=foundation",
    audienceCallout: "Owner-operators with 1–2 properties",
    features: [
      { label: "Custom-branded marketing site, managed" },
      { label: "Live AppFolio listings sync" },
      { label: "AI chatbot — 1,000 conversations/mo" },
      { label: "Lead capture + multi-property CRM" },
      { label: "Reputation monitoring (Google, Reddit, web)" },
      { label: "Standard reports + monthly digest" },
      { label: "Email support, 48-hour SLA" },
    ],
  },
  {
    id: "growth",
    checkoutTierId: "growth",
    name: "Growth",
    tagline: "The full marketing flywheel running.",
    monthly: 899,
    annual: 749,
    setupFee: 2500,
    highlighted: true,
    ctaLabel: "Start with Growth",
    ctaHref: "/onboarding?plan=growth",
    audienceCallout: "Mid-market operators ready to scale",
    features: [
      { label: "Everything in Foundation, plus:" },
      {
        label: "Cursive Pixel — identify 5,000 visitors/mo",
        emphasis: true,
      },
      {
        label: "Google + Meta ad campaign management",
        emphasis: true,
      },
      { label: "Creative studio — 2 ad creatives/mo" },
      { label: "SEO module (GSC + GA4, monthly recs)" },
      { label: "Advanced attribution + funnel reports" },
      { label: "Shared Slack channel, 24-hour SLA" },
    ],
  },
  {
    id: "scale",
    checkoutTierId: "scale",
    name: "Scale",
    tagline: "Push paid + organic + audience at portfolio scale.",
    monthly: 1499,
    annual: 1199,
    setupFee: 3500,
    highlighted: false,
    ctaLabel: "Start with Scale",
    ctaHref: "/onboarding?plan=scale",
    audienceCallout: "Operators with 5+ properties",
    features: [
      { label: "Everything in Growth, plus:" },
      {
        label: "Cursive Pixel — identify 25,000 visitors/mo",
        emphasis: true,
      },
      { label: "Unlimited ad creative requests", emphasis: true },
      {
        label: "Audience builder + sync (Meta, Google, TikTok)",
        emphasis: true,
      },
      { label: "Outbound email — 3,000 sends/mo" },
      { label: "Referral program" },
      { label: "Quarterly business review" },
      { label: "Priority support, 4-hour SLA + CSM" },
    ],
  },
  {
    id: "enterprise",
    checkoutTierId: null,
    name: "Enterprise",
    tagline: "Multi-brand portfolios, white-label, custom integrations.",
    monthly: null,
    annual: null,
    setupFee: null,
    highlighted: false,
    ctaLabel: "Talk to sales",
    ctaHref: "/demo?plan=enterprise",
    audienceCallout: "20+ properties or multi-brand operators",
    features: [
      { label: "Everything in Scale, plus:" },
      { label: "Volume pricing (25–35% off list)" },
      { label: "White-label tenant portal" },
      { label: "Custom integrations (non-AppFolio PMS)" },
      { label: "Named build team + custom SLAs" },
      { label: "Quarterly strategy + dedicated CSM" },
      { label: "Annual / multi-year terms available" },
    ],
  },
];

export function PricingTiers() {
  const [cycle, setCycle] = React.useState<BillingCycle>("monthly");

  return (
    <section style={{ backgroundColor: "#f5f4ed" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 pb-16 md:pb-20">
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
            <TierCard key={t.id} tier={t} cycle={cycle} />
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
          One-time setup fee covers site build, AppFolio sync wiring, chatbot
          training, and DNS. Ad-spend management billed at a 15% markup on
          your monthly ad budget — only when you run ads. Additional properties
          on the same plan get a 20% discount.
        </p>
      </div>
    </section>
  );
}

function TierCard({ tier, cycle }: { tier: Tier; cycle: BillingCycle }) {
  const price =
    cycle === "monthly" ? tier.monthly : tier.annual;
  const highlighted = tier.highlighted;
  const [submitting, setSubmitting] = React.useState(false);

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
          propertyCount: 1,
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
  }, [tier.checkoutTierId, cycle, submitting]);

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

      {/* Price block */}
      <div className="mb-2 min-h-[88px]">
        {price == null ? (
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
                ${price.toLocaleString()}
              </span>
              <span
                style={{
                  color: mutedText,
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                /mo · per property
              </span>
            </div>
            {cycle === "annual" && tier.monthly ? (
              <p
                className="mt-1"
                style={{
                  color: accentText,
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  fontWeight: 500,
                }}
              >
                Billed yearly · saves ${(tier.monthly - tier.annual!) * 12}/yr
              </p>
            ) : tier.setupFee != null ? (
              <p
                className="mt-1"
                style={{
                  color: mutedText,
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                }}
              >
                ${tier.setupFee.toLocaleString()} one-time setup
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
