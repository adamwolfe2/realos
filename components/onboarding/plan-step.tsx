"use client";

import * as React from "react";
import {
  ArrowLeft,
  Check,
  Sparkles,
  Bot,
  Eye,
  TrendingUp,
  BarChart3,
  Brush,
  Globe,
  Share2,
  Users,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { SubscriptionTier } from "@prisma/client";
import { TIERS } from "@/lib/billing/catalog";

// Step 4 of the onboarding wizard. The user picks a tier AND the modules
// they want to test during their 14-day trial. We start the trial, flip
// the tier's default module entitlements on, and additionally flip on any
// extra modules the operator hand-picked.
//
// All modules are FREE during trial. The selection drives:
//   - which features render unlocked in the portal during the trial
//   - the list of add-ons we surface in the conversion-to-paid Stripe
//     checkout flow on day 14

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

// Module catalog for the picker. Mirrors the server-only marketplace
// catalog (toggleable modules + always-on baseline) but lives client-side
// so this component can render without a server round-trip. If the
// marketplace catalog ever grows, sync this list.
type PickerModule = {
  key: string;
  name: string;
  copy: string;
  icon: LucideIcon;
  // Which tier first unlocks this module. We grey out modules above the
  // selected tier so the operator sees the upgrade ladder honestly.
  unlockedAt: "starter" | "growth" | "scale";
  // Always-on (included in every tier) — selected by default, can't be
  // toggled off. Just shown so the operator sees what they get for free.
  alwaysOn?: boolean;
};

const PICKER_MODULES: PickerModule[] = [
  {
    key: "moduleWebsite",
    name: "Marketing site",
    copy: "Per-property site with listings sync and lead capture.",
    icon: Globe,
    unlockedAt: "starter",
    alwaysOn: true,
  },
  {
    key: "moduleChatbot",
    name: "AI leasing chatbot",
    copy: "24/7 AI that answers, captures leads, books tours.",
    icon: Bot,
    unlockedAt: "starter",
  },
  {
    key: "moduleLeadCapture",
    name: "Lead capture",
    copy: "Forms, ingest API, and inbox routing for every lead.",
    icon: Users,
    unlockedAt: "starter",
    alwaysOn: true,
  },
  {
    key: "reputation",
    name: "Reputation monitoring",
    copy: "Google, Reddit, Yelp, and the open web in one inbox.",
    icon: Star,
    unlockedAt: "starter",
    alwaysOn: true,
  },
  {
    key: "modulePixel",
    name: "Visitor pixel",
    copy: "Identify anonymous site visitors — name, email, intent.",
    icon: Eye,
    unlockedAt: "growth",
  },
  {
    key: "moduleGoogleAds",
    name: "Google Ads",
    copy: "Search + Performance Max campaigns with ROAS reporting.",
    icon: BarChart3,
    unlockedAt: "growth",
  },
  {
    key: "moduleMetaAds",
    name: "Meta Ads",
    copy: "Facebook + Instagram campaigns with pixel retargeting.",
    icon: BarChart3,
    unlockedAt: "growth",
  },
  {
    key: "moduleSEO",
    name: "SEO + AI discovery",
    copy: "Neighborhood pages built to rank and get cited by AI.",
    icon: TrendingUp,
    unlockedAt: "growth",
  },
  {
    key: "moduleCreativeStudio",
    name: "Creative studio",
    copy: "On-brand ad and social creative, 48-hour turnaround.",
    icon: Brush,
    unlockedAt: "growth",
  },
  {
    key: "moduleReferrals",
    name: "Resident referrals",
    copy: "Trackable per-property links with full attribution.",
    icon: Share2,
    unlockedAt: "scale",
  },
];

const TIER_RANK: Record<"starter" | "growth" | "scale", number> = {
  starter: 0,
  growth: 1,
  scale: 2,
};

function tierMonthlyDisplay(id: "starter" | "growth" | "scale"): number {
  const t = TIERS.find((x) => x.id === id);
  if (!t) return 0;
  return Math.round(t.monthly.unitAmountCents / 100);
}

// Default-selected modules for each tier — the ones the operator most
// likely wants to test first. Other modules are visible but unchecked.
const TIER_DEFAULTS: Record<"starter" | "growth" | "scale", string[]> = {
  starter: ["moduleChatbot"],
  growth: ["moduleChatbot", "modulePixel", "moduleGoogleAds", "moduleSEO"],
  scale: [
    "moduleChatbot",
    "modulePixel",
    "moduleGoogleAds",
    "moduleMetaAds",
    "moduleSEO",
    "moduleReferrals",
  ],
};

type PlanStepBody = {
  tierId: "starter" | "growth" | "scale";
  selectedModules: string[];
};

export function PlanStep({
  chosenTier,
  onSubmit,
  disabled,
}: {
  chosenTier: SubscriptionTier | null;
  onSubmit: (body: PlanStepBody) => void;
  disabled: boolean;
}) {
  const initialId: "starter" | "growth" | "scale" =
    chosenTier === "STARTER"
      ? "starter"
      : chosenTier === "SCALE"
        ? "scale"
        : "growth";
  const [selected, setSelected] = React.useState<typeof initialId>(initialId);
  const [picked, setPicked] = React.useState<Set<string>>(
    () => new Set(TIER_DEFAULTS[initialId]),
  );

  // When tier changes, reset to that tier's default-on modules. The user
  // can then add/remove from the suggested list.
  const handleTierChange = (id: "starter" | "growth" | "scale") => {
    setSelected(id);
    setPicked(new Set(TIER_DEFAULTS[id]));
  };

  const togglePick = (key: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (disabled) return;
    onSubmit({
      tierId: selected,
      selectedModules: Array.from(picked),
    });
  };

  const tierRank = TIER_RANK[selected];

  return (
    <form onSubmit={handle} className="space-y-7">
      <header>
        <p
          className="eyebrow"
          style={{ color: "#2563EB", letterSpacing: "0.16em" }}
        >
          Step 4 of 4
        </p>
        <h1
          className="mt-2"
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-sans)",
            fontSize: "26px",
            fontWeight: 700,
            letterSpacing: "-0.014em",
          }}
        >
          Pick a plan and the modules you want to try.
        </h1>
        <p
          className="mt-2"
          style={{
            color: "#64748B",
            fontFamily: "var(--font-sans)",
            fontSize: "14.5px",
            lineHeight: 1.55,
          }}
        >
          No card required. Every module is free during your 14-day trial.
          We&apos;ll remember what you picked so the activation flow only
          charges for the modules you keep.
        </p>
      </header>

      {/* Tier selector */}
      <fieldset className="space-y-2" disabled={disabled}>
        <legend
          style={{
            color: "#0B1220",
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: "10px",
          }}
        >
          Plan
        </legend>
        {TIER_DISPLAY.map((t) => {
          const active = selected === t.id;
          const price = tierMonthlyDisplay(t.id);
          return (
            <label
              key={t.id}
              htmlFor={`tier-${t.id}`}
              className="block cursor-pointer rounded-xl transition-colors"
              style={{
                backgroundColor: active ? "rgba(37,99,235,0.04)" : "#F8FAFC",
                border: active ? "1px solid #2563EB" : "1px solid #E2E8F0",
                padding: "14px 16px",
              }}
            >
              <input
                id={`tier-${t.id}`}
                type="radio"
                name="tier"
                value={t.id}
                checked={active}
                onChange={() => handleTierChange(t.id)}
                className="sr-only"
              />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      style={{
                        color: "#0B1220",
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
                        <Sparkles
                          size={10}
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                        Most popular
                      </span>
                    ) : null}
                  </div>
                  <p
                    className="mt-1"
                    style={{
                      color: "#64748B",
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      lineHeight: 1.5,
                    }}
                  >
                    {t.tagline}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div
                    style={{
                      color: "#0B1220",
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
                      color: "#94A3B8",
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
                        : "1.5px solid #E2E8F0",
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

      {/* Module picker */}
      <fieldset disabled={disabled}>
        <legend
          style={{
            color: "#0B1220",
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: "10px",
          }}
        >
          Modules to try
        </legend>
        <p
          style={{
            color: "#64748B",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            lineHeight: 1.5,
            marginBottom: "14px",
          }}
        >
          Pick anything you&apos;d like to test. All free during your trial.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PICKER_MODULES.map((m) => {
            const locked = TIER_RANK[m.unlockedAt] > tierRank;
            const isAlwaysOn = !!m.alwaysOn;
            const checked = isAlwaysOn || picked.has(m.key);
            const Icon = m.icon;
            return (
              <label
                key={m.key}
                htmlFor={`mod-${m.key}`}
                className="block rounded-xl transition-colors"
                style={{
                  backgroundColor: checked
                    ? "rgba(37,99,235,0.04)"
                    : "#F8FAFC",
                  border: checked
                    ? "1px solid #2563EB"
                    : "1px solid #E2E8F0",
                  padding: "12px 14px",
                  cursor: locked || isAlwaysOn ? "not-allowed" : "pointer",
                  opacity: locked ? 0.5 : 1,
                }}
              >
                <input
                  id={`mod-${m.key}`}
                  type="checkbox"
                  checked={checked}
                  disabled={locked || isAlwaysOn}
                  onChange={() => togglePick(m.key)}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <div
                    className="inline-flex items-center justify-center rounded-md shrink-0"
                    style={{
                      width: 28,
                      height: 28,
                      backgroundColor: checked
                        ? "#2563EB"
                        : "rgba(15,23,42,0.06)",
                      color: checked ? "#FFFFFF" : "#475569",
                      marginTop: "1px",
                    }}
                  >
                    <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        style={{
                          color: "#0B1220",
                          fontFamily: "var(--font-sans)",
                          fontSize: "13.5px",
                          fontWeight: 600,
                          letterSpacing: "-0.005em",
                        }}
                      >
                        {m.name}
                      </span>
                      {isAlwaysOn ? (
                        <span
                          style={{
                            color: "#94A3B8",
                            fontFamily: "var(--font-mono)",
                            fontSize: "9.5px",
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            fontWeight: 600,
                          }}
                        >
                          Included
                        </span>
                      ) : locked ? (
                        <span
                          style={{
                            color: "#94A3B8",
                            fontFamily: "var(--font-mono)",
                            fontSize: "9.5px",
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            fontWeight: 600,
                          }}
                        >
                          {m.unlockedAt.charAt(0).toUpperCase() +
                            m.unlockedAt.slice(1)}
                          +
                        </span>
                      ) : null}
                    </div>
                    <p
                      className="mt-0.5"
                      style={{
                        color: "#64748B",
                        fontFamily: "var(--font-sans)",
                        fontSize: "12px",
                        lineHeight: 1.45,
                      }}
                    >
                      {m.copy}
                    </p>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p
        style={{
          color: "#94A3B8",
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          lineHeight: 1.5,
        }}
      >
        Your trial unlocks every module you picked above. At the end of the
        14 days we&apos;ll show you a Stripe checkout with exactly these
        modules — drop any you didn&apos;t use, keep the rest.
      </p>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => history.back()}
          className="inline-flex items-center gap-1.5 transition-colors"
          style={{
            color: "#64748B",
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
            backgroundColor: "#0B1220",
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
