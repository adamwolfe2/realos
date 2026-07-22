"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// ---------------------------------------------------------------------------
// PricingBuilder — the centerpiece of the pricing page. Replaces the old
// tier-cards + separate à-la-carte grid dual story with ONE configurator:
// base platform fee (always on) + toggleable features + a property-count
// stepper + a monthly/annual cycle, resolving to a single live total.
//
// Prices come from the live admin catalog (getEffectiveFeatureCatalog),
// passed down from the server component in page.tsx. Math is intentionally
// simple and literal to what's on screen: (base + selected features) times
// property count, with the annual cycle applying the same 17% prepay
// discount quoted elsewhere on the site (lib/billing/catalog.ts TIERS).
//
// At 20+ properties self-serve stops making sense (that's squarely
// Enterprise territory below), so the CTA swaps from "Start free trial" to
// "Talk to us about volume pricing" and routes to the existing book-a-demo
// flow instead of account creation.
// ---------------------------------------------------------------------------

export type BuilderFeature = {
  key: string;
  name: string;
  copy: string;
  monthlyCents: number;
  recommended?: boolean;
};

type BillingCycle = "monthly" | "annual";

const MAX_PROPERTIES = 20;
// Matches the "Save 17%" prepay discount quoted on the annual toggle
// elsewhere on the site (lib/billing/catalog.ts TIERS annual pricing).
const ANNUAL_MULTIPLIER = 0.83;

function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export function PricingBuilder({
  features,
  basePlatformCents,
}: {
  features: BuilderFeature[];
  basePlatformCents: number;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(features.filter((f) => f.recommended).map((f) => f.key)),
  );
  const [propertyCount, setPropertyCount] = React.useState(1);
  const [cycle, setCycle] = React.useState<BillingCycle>("monthly");

  const toggleFeature = React.useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectedFeatures = features.filter((f) => selected.has(f.key));
  const featuresPerPropertyCents = selectedFeatures.reduce(
    (sum, f) => sum + f.monthlyCents,
    0,
  );
  const perPropertyCents = basePlatformCents + featuresPerPropertyCents;
  const monthlyTotalCents = perPropertyCents * propertyCount;
  const displayTotalCents =
    cycle === "annual"
      ? Math.round(monthlyTotalCents * ANNUAL_MULTIPLIER)
      : monthlyTotalCents;
  const annualSavingsCents =
    cycle === "annual"
      ? Math.round(monthlyTotalCents * (1 - ANNUAL_MULTIPLIER) * 12)
      : 0;

  const isVolume = propertyCount >= MAX_PROPERTIES;

  const ctaHref = React.useMemo(() => {
    const params = new URLSearchParams();
    if (selectedFeatures.length > 0) {
      params.set("features", selectedFeatures.map((f) => f.key).join(","));
    }
    params.set("properties", String(propertyCount));
    return `/sign-up?${params.toString()}`;
  }, [selectedFeatures, propertyCount]);

  return (
    <section
      id="builder"
      className="scroll-mt-24"
      style={{ backgroundColor: "var(--color-surface, #f4f4f4)" }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="max-w-2xl mb-10">
          <h2
            className="heading-section"
            style={{ color: "#1E2A3A", fontSize: "clamp(24px, 3vw, 32px)" }}
          >
            Build your platform.
          </h2>
          <p
            className="mt-4"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.55,
            }}
          >
            Every property starts with the base platform. Turn on what it
            needs now, the total updates as you go, and you can flip any
            feature on or off later without calling anyone.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Feature list */}
          <div className="flex flex-col gap-3">
            {/* Base platform — always included, no toggle. */}
            <div
              className="rounded-[2px] p-5 flex items-start justify-between gap-4"
              style={{ backgroundColor: "#ffffff", border: "1px solid var(--color-primary)" }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--color-primary)",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  Always included
                </div>
                <h3
                  style={{
                    color: "#1E2A3A",
                    fontFamily: "var(--font-sans)",
                    fontSize: "15px",
                    fontWeight: 600,
                  }}
                >
                  LeaseStack platform
                </h3>
                <p
                  className="mt-1"
                  style={{
                    color: "#64748B",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    lineHeight: 1.55,
                  }}
                >
                  Stop reconciling six vendor logins. One dashboard for
                  leads, the site, and the team, every feature below plugs
                  straight into it.
                </p>
              </div>
              <div className="text-right shrink-0">
                <div
                  style={{
                    color: "#1E2A3A",
                    fontFamily: "var(--font-sans)",
                    fontSize: "18px",
                    fontWeight: 700,
                  }}
                >
                  {dollars(basePlatformCents)}
                </div>
                <div
                  style={{
                    color: "var(--stone-gray)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "11px",
                  }}
                >
                  per property / mo
                </div>
              </div>
            </div>

            {/* Feature rows — checkbox toggles. */}
            {features.map((feature) => {
              const isOn = selected.has(feature.key);
              return (
                <label
                  key={feature.key}
                  className="rounded-[2px] p-5 flex items-start justify-between gap-4 cursor-pointer transition-colors active:scale-[0.98]"
                  style={{
                    backgroundColor: "#ffffff",
                    border: isOn
                      ? "1px solid var(--color-primary)"
                      : "1px solid var(--hair)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggleFeature(feature.key)}
                    className="sr-only"
                    aria-label={`Add ${feature.name}`}
                  />
                  <div className="flex items-start gap-4">
                    <span
                      aria-hidden
                      className="mt-0.5 shrink-0 rounded-[2px] inline-flex items-center justify-center"
                      style={{
                        width: 20,
                        height: 20,
                        border: isOn
                          ? "1px solid var(--color-primary)"
                          : "1px solid var(--hair-strong)",
                        backgroundColor: isOn ? "var(--color-primary)" : "#ffffff",
                      }}
                    >
                      {isOn ? <Check size={13} strokeWidth={3} color="#ffffff" /> : null}
                    </span>
                    <div>
                      {feature.recommended ? (
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "10px",
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: "var(--color-primary)",
                            fontWeight: 600,
                            marginBottom: "4px",
                          }}
                        >
                          Popular
                        </div>
                      ) : null}
                      <h3
                        style={{
                          color: "#1E2A3A",
                          fontFamily: "var(--font-sans)",
                          fontSize: "15px",
                          fontWeight: 600,
                          letterSpacing: "-0.008em",
                        }}
                      >
                        {feature.name}
                      </h3>
                      <p
                        className="mt-1"
                        style={{
                          color: "#64748B",
                          fontFamily: "var(--font-sans)",
                          fontSize: "13px",
                          lineHeight: 1.55,
                          maxWidth: "52ch",
                        }}
                      >
                        {feature.copy}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      style={{
                        color: "#1E2A3A",
                        fontFamily: "var(--font-sans)",
                        fontSize: "15px",
                        fontWeight: 700,
                      }}
                    >
                      {dollars(feature.monthlyCents)}
                    </div>
                    <div
                      style={{
                        color: "var(--stone-gray)",
                        fontFamily: "var(--font-sans)",
                        fontSize: "11px",
                      }}
                    >
                      per property / mo
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Sticky live total */}
          <div
            className="lg:sticky lg:top-24 rounded-[2px] p-5 flex flex-col gap-5"
            style={{ backgroundColor: "#ffffff", border: "1px solid var(--hair)" }}
          >
            {/* Property-count stepper */}
            <div>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--stone-gray)",
                  fontWeight: 600,
                  marginBottom: "8px",
                }}
              >
                Properties
              </p>
              <div
                className="inline-flex items-center gap-3 rounded-full w-full justify-between"
                style={{ border: "1px solid var(--hair)", padding: "6px 8px" }}
              >
                <button
                  type="button"
                  onClick={() => setPropertyCount((n) => Math.max(1, n - 1))}
                  disabled={propertyCount <= 1}
                  aria-label="Decrease property count"
                  className="inline-flex items-center justify-center rounded-full text-base font-semibold transition-colors disabled:opacity-30 active:scale-[0.98]"
                  style={{ width: 32, height: 32, color: "#1E2A3A" }}
                >
                  &minus;
                </button>
                <span
                  className="tabular-nums"
                  style={{
                    color: "#1E2A3A",
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  {propertyCount}
                  {isVolume ? "+" : ""}{" "}
                  <span style={{ color: "var(--stone-gray)", fontWeight: 500 }}>
                    {propertyCount === 1 ? "property" : "properties"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPropertyCount((n) => Math.min(MAX_PROPERTIES, n + 1))
                  }
                  disabled={propertyCount >= MAX_PROPERTIES}
                  aria-label="Increase property count"
                  className="inline-flex items-center justify-center rounded-full text-base font-semibold transition-colors disabled:opacity-30 active:scale-[0.98]"
                  style={{ width: 32, height: 32, color: "#1E2A3A" }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Billing cycle toggle */}
            <div>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--stone-gray)",
                  fontWeight: 600,
                  marginBottom: "8px",
                }}
              >
                Billing
              </p>
              <div
                role="tablist"
                aria-label="Billing cycle"
                className="inline-flex items-center p-1 rounded-full w-full"
                style={{ border: "1px solid var(--hair)" }}
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
                      className="relative flex-1 inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-full transition-colors active:scale-[0.98]"
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
                              : "var(--brand-soft, #eff6ff)",
                            color: active ? "#ffffff" : "var(--color-primary)",
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

            <div style={{ borderTop: "1px solid var(--hair)" }} />

            {/* Live total */}
            <div>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--stone-gray)",
                  fontWeight: 600,
                  marginBottom: "6px",
                }}
              >
                Total
              </p>
              <p
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "28px",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                }}
              >
                {dollars(displayTotalCents)}
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "var(--stone-gray)",
                  }}
                >
                  /mo for {propertyCount}
                  {isVolume ? "+" : ""} {propertyCount === 1 ? "property" : "properties"}
                </span>
              </p>
              {cycle === "annual" && annualSavingsCents > 0 ? (
                <p
                  className="mt-1"
                  style={{
                    color: "var(--color-primary)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    fontWeight: 500,
                  }}
                >
                  Billed annually, saves {dollars(annualSavingsCents)}/yr
                </p>
              ) : null}
            </div>

            {isVolume ? (
              <BookDemoLink
                className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-semibold text-white transition-colors active:scale-[0.98]"
                style={{ backgroundColor: "var(--color-primary)" }}
                ariaLabel="Talk to us about volume pricing"
              >
                Talk to us about volume pricing
              </BookDemoLink>
            ) : (
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-semibold text-white transition-colors active:scale-[0.98]"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Start free trial
              </Link>
            )}

            <p
              style={{
                color: "var(--stone-gray)",
                fontFamily: "var(--font-sans)",
                fontSize: "11.5px",
                lineHeight: 1.5,
              }}
            >
              14-day free trial. No card required.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
