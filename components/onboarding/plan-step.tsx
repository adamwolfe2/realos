"use client";

import * as React from "react";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import type { SubscriptionTier } from "@prisma/client";
import { TIERS } from "@/lib/billing/catalog";

// Step 3 of the onboarding wizard. The user picks a tier; we start
// their 14-day trial and unlock the matching module entitlements.
// They see real prices on each card, framed as "what you'll pay after
// trial" — no card collected here.

const TIER_DISPLAY: Array<{
  id: "starter" | "growth" | "scale";
  name: string;
  tagline: string;
  bullets: string[];
  highlighted: boolean;
}> = [
  {
    id: "starter",
    name: "Foundation",
    tagline: "Core platform for a single property.",
    highlighted: false,
    bullets: [
      "Marketing site builder",
      "AppFolio listings sync",
      "AI leasing chatbot (1,000 conversations/mo)",
      "Lead capture and CRM",
      "Reputation monitoring",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Add paid acquisition and attribution.",
    highlighted: true,
    bullets: [
      "Everything in Foundation",
      "Cursive visitor pixel (5,000/mo)",
      "Google and Meta ad campaign builder",
      "SEO module (GSC and GA4)",
      "Multi-touch attribution",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "Audiences, outbound, and unlimited chatbot.",
    highlighted: false,
    bullets: [
      "Everything in Growth",
      "Pixel bumped to 25,000/mo",
      "Audience builder with sync (Meta, Google, TikTok)",
      "Outbound email (3,000 sends/mo)",
      "Resident referrals",
    ],
  },
];

function tierMonthlyDisplay(id: "starter" | "growth" | "scale"): number {
  const t = TIERS.find((x) => x.id === id);
  if (!t) return 0;
  return Math.round(t.monthly.unitAmountCents / 100);
}

export function PlanStep({
  chosenTier,
  onSubmit,
  disabled,
}: {
  chosenTier: SubscriptionTier | null;
  onSubmit: (body: { tierId: "starter" | "growth" | "scale" }) => void;
  disabled: boolean;
}) {
  // Map an existing SubscriptionTier on the org back to one of our
  // wizard ids. Defaults to growth for first-time picks (it's the
  // most-popular tier and what most operators land on).
  const initialId: "starter" | "growth" | "scale" =
    chosenTier === "STARTER"
      ? "starter"
      : chosenTier === "SCALE"
        ? "scale"
        : "growth";
  const [selected, setSelected] = React.useState<typeof initialId>(initialId);

  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (disabled) return;
    onSubmit({ tierId: selected });
  };

  return (
    <form onSubmit={handle} className="space-y-7">
      <header>
        <p
          className="eyebrow"
          style={{ color: "#2563EB", letterSpacing: "0.16em" }}
        >
          Step 3 of 3
        </p>
        <h1
          className="mt-2"
          style={{
            color: "#141413",
            fontFamily: "var(--font-sans)",
            fontSize: "26px",
            fontWeight: 700,
            letterSpacing: "-0.014em",
          }}
        >
          Pick a plan. Start your 14-day trial.
        </h1>
        <p
          className="mt-2"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "14.5px",
            lineHeight: 1.55,
          }}
        >
          No card required. Add properties, configure your workspace, and
          feel the value first. On day 14 we&apos;ll show you a price based
          on the number of properties you actually built, and you decide
          whether to activate.
        </p>
      </header>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="sr-only">Pick a tier</legend>
        {TIER_DISPLAY.map((t) => {
          const active = selected === t.id;
          const price = tierMonthlyDisplay(t.id);
          return (
            <label
              key={t.id}
              htmlFor={`tier-${t.id}`}
              className="block cursor-pointer rounded-xl transition-colors"
              style={{
                backgroundColor: active ? "rgba(37,99,235,0.04)" : "#faf9f5",
                border: active ? "1px solid #2563EB" : "1px solid #e8e6dc",
                padding: "14px 16px",
              }}
            >
              <input
                id={`tier-${t.id}`}
                type="radio"
                name="tier"
                value={t.id}
                checked={active}
                onChange={() => setSelected(t.id)}
                className="sr-only"
              />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      style={{
                        color: "#141413",
                        fontFamily: "var(--font-sans)",
                        fontSize: "16px",
                        fontWeight: 700,
                        letterSpacing: "-0.008em",
                      }}
                    >
                      {t.name}
                    </span>
                    {t.highlighted ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full"
                        style={{
                          backgroundColor: "rgba(37,99,235,0.08)",
                          color: "#2563EB",
                          padding: "2px 8px",
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          fontWeight: 600,
                        }}
                      >
                        <Sparkles size={10} strokeWidth={2.5} aria-hidden="true" />
                        Most popular
                      </span>
                    ) : null}
                  </div>
                  <p
                    className="mt-1"
                    style={{
                      color: "#5e5d59",
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      lineHeight: 1.5,
                    }}
                  >
                    {t.tagline}
                  </p>
                  <ul className="mt-3 space-y-1">
                    {t.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-1.5"
                        style={{
                          color: "#4d4c48",
                          fontFamily: "var(--font-sans)",
                          fontSize: "12.5px",
                          lineHeight: 1.5,
                        }}
                      >
                        <Check
                          size={13}
                          strokeWidth={2.5}
                          className="mt-[3px] shrink-0"
                          style={{ color: "#2563EB" }}
                          aria-hidden="true"
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-right shrink-0">
                  <div
                    style={{
                      color: "#141413",
                      fontFamily: "var(--font-sans)",
                      fontSize: "22px",
                      fontWeight: 700,
                      letterSpacing: "-0.012em",
                      lineHeight: 1,
                    }}
                  >
                    ${price.toLocaleString()}
                  </div>
                  <div
                    style={{
                      color: "#88867f",
                      fontFamily: "var(--font-sans)",
                      fontSize: "11.5px",
                      marginTop: "2px",
                    }}
                  >
                    /mo · per property
                  </div>
                  <div
                    className="mt-2 inline-flex items-center justify-center rounded-full"
                    style={{
                      width: 22,
                      height: 22,
                      border: active
                        ? "2px solid #2563EB"
                        : "1.5px solid #d6d3c8",
                      backgroundColor: active ? "#2563EB" : "#ffffff",
                    }}
                    aria-hidden="true"
                  >
                    {active ? (
                      <Check
                        size={12}
                        strokeWidth={3}
                        style={{ color: "#ffffff" }}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </fieldset>

      <p
        style={{
          color: "#88867f",
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          lineHeight: 1.5,
        }}
      >
        Your trial unlocks the features for the tier you picked. You can
        change tiers any time before or during activation. We&apos;ll send a
        gentle reminder a few days before the trial ends.
      </p>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => history.back()}
          className="inline-flex items-center gap-1.5 transition-colors"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={14} strokeWidth={2.5} aria-hidden="true" />
          Back
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "#2563EB",
            color: "#ffffff",
            padding: "12px 22px",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Start free trial
        </button>
      </div>
    </form>
  );
}
