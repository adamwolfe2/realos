"use client";

import * as React from "react";
import {
  Bot,
  Eye,
  TrendingUp,
  BarChart3,
  Brush,
  Globe,
  Share2,
  Users,
  Star,
  Calendar,
  Handshake,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useCalDemo } from "@/components/marketing/cal-demo-modal";

// ---------------------------------------------------------------------------
// Step 4 — "How do you want to start?"
//
// Norman feedback (2026-06-02): the previous step 4 was a 540-line
// pricing-tier grid with monthly/annual toggles and per-tier feature
// lists. That belongs on /pricing, not in the onboarding wizard. For
// the trial-signup flow we strip pricing out entirely and ask one
// question: how do you want to start? Three answers:
//
//   1. Book a 30-min walkthrough (PRIMARY) → opens Cal.com modal
//   2. Request a pilot (SECONDARY) → opens Cal.com modal (sales-led)
//   3. Continue with the free trial (TERTIARY, muted) → posts to the
//      existing /api/onboarding/wizard/start-trial endpoint with a
//      defaulted "growth" tier and the modules the user picked
//
// Modules stay on this step (Norman said "include modules here") but
// rendered as a compact grid above the decision cards instead of as a
// per-tier upgrade ladder. Default selection mirrors the growth tier's
// defaults — operators can opt out of any non-included module.
// ---------------------------------------------------------------------------

type PickerModule = {
  key: string;
  name: string;
  copy: string;
  icon: LucideIcon;
  alwaysOn?: boolean;
};

const PICKER_MODULES: PickerModule[] = [
  {
    key: "moduleWebsite",
    name: "Marketing site",
    copy: "Per-property site with listings sync and lead capture.",
    icon: Globe,
    alwaysOn: true,
  },
  {
    key: "moduleChatbot",
    name: "AI leasing chatbot",
    copy: "24/7 AI that answers, captures leads, books tours.",
    icon: Bot,
  },
  {
    key: "moduleLeadCapture",
    name: "Lead capture",
    copy: "Forms, ingest API, and inbox routing for every lead.",
    icon: Users,
    alwaysOn: true,
  },
  {
    key: "reputation",
    name: "Reputation monitoring",
    copy: "Google, Reddit, Yelp, and the open web in one inbox.",
    icon: Star,
    alwaysOn: true,
  },
  {
    key: "modulePixel",
    name: "Visitor pixel",
    copy: "Identify anonymous site visitors — name, email, intent.",
    icon: Eye,
  },
  {
    key: "moduleGoogleAds",
    name: "Google Ads",
    copy: "Search + Performance Max campaigns with ROAS reporting.",
    icon: BarChart3,
  },
  {
    key: "moduleMetaAds",
    name: "Meta Ads",
    copy: "Facebook + Instagram campaigns with pixel retargeting.",
    icon: BarChart3,
  },
  {
    key: "moduleSEO",
    name: "SEO + AI discovery",
    copy: "Neighborhood pages built to rank and get cited by AI.",
    icon: TrendingUp,
  },
  {
    key: "moduleCreativeStudio",
    name: "Creative studio",
    copy: "On-brand ad and social creative, 48-hour turnaround.",
    icon: Brush,
  },
  {
    key: "moduleReferrals",
    name: "Resident referrals",
    copy: "Trackable per-property links with full attribution.",
    icon: Share2,
  },
];

// Pre-checked at first render so a user who hits "Continue with free
// trial" without touching the picker still gets a useful default set.
// Mirrors what the Growth tier ships with by default — the tier we
// recommend for 60-70% of new operators.
const DEFAULT_SELECTED = [
  "moduleWebsite",
  "moduleChatbot",
  "moduleLeadCapture",
  "reputation",
  "modulePixel",
  "moduleGoogleAds",
  "moduleSEO",
];

const INK = "#1E2A3A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const ACCENT = "#2563EB";

export function PlanStep({
  chosenTier,
  onSubmit,
  disabled,
}: {
  chosenTier: string | null;
  onSubmit: (body: {
    tierId: "starter" | "growth" | "scale";
    selectedModules: string[];
  }) => void;
  disabled?: boolean;
}) {
  void chosenTier; // No longer drives the form — kept for backwards-compat with the wizard host signature.

  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(DEFAULT_SELECTED),
  );
  const cal = useCalDemo();

  const toggleModule = React.useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleStartTrial = React.useCallback(() => {
    if (disabled) return;
    // We default the persisted tier to "growth". The tier picker has
    // been removed from this step (lives on /pricing instead) but the
    // backend still expects a tierId. Growth is the tier we recommend
    // for the majority of operators; conversion-to-paid flow allows
    // them to switch later without re-onboarding.
    onSubmit({
      tierId: "growth",
      selectedModules: Array.from(selected),
    });
  }, [onSubmit, selected, disabled]);

  return (
    <div className="space-y-7">
      <header>
        <p
          style={{
            color: MUTED,
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Step 4 of 4 · How do you want to start?
        </p>
        <h1
          className="mt-2 leading-tight"
          style={{
            color: INK,
            fontFamily: "var(--font-serif)",
            fontSize: "26px",
            fontWeight: 500,
            letterSpacing: "-0.018em",
          }}
        >
          Pick the next move.
        </h1>
        <p
          className="mt-2"
          style={{
            color: MUTED,
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            lineHeight: 1.55,
          }}
        >
          You can book a walkthrough with the team, talk to us about a paid
          pilot, or jump straight into a free 14-day trial. The modules below
          travel with whichever path you pick.
        </p>
      </header>

      {/* Module picker — compact grid, no tier ladder. Always-on modules
          are shown checked + disabled so the operator sees what comes
          included; the rest are opt-in toggles for the trial. */}
      <section>
        <p
          style={{
            color: INK,
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          What to include
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PICKER_MODULES.map((m) => {
            const isOn = m.alwaysOn || selected.has(m.key);
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => !m.alwaysOn && toggleModule(m.key)}
                disabled={!!m.alwaysOn || disabled}
                className="text-left rounded-lg transition-colors"
                style={{
                  padding: "10px 12px",
                  border: `1px solid ${isOn ? ACCENT : BORDER}`,
                  backgroundColor: isOn ? "rgba(37,99,235,0.04)" : "#FFFFFF",
                  cursor: m.alwaysOn ? "default" : "pointer",
                  opacity: disabled ? 0.6 : 1,
                }}
                aria-pressed={isOn}
              >
                <span className="flex items-start gap-2.5">
                  <Icon
                    className="w-3.5 h-3.5 shrink-0 mt-0.5"
                    strokeWidth={1.5}
                    style={{ color: isOn ? ACCENT : MUTED }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0">
                    <span
                      style={{
                        color: INK,
                        fontFamily: "var(--font-sans)",
                        fontSize: "13px",
                        fontWeight: 600,
                        display: "block",
                        letterSpacing: "-0.005em",
                      }}
                    >
                      {m.name}
                      {m.alwaysOn ? (
                        <span
                          className="ml-1.5"
                          style={{
                            color: MUTED,
                            fontFamily: "var(--font-mono)",
                            fontSize: "9.5px",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            fontWeight: 500,
                          }}
                        >
                          Always on
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="mt-0.5 block"
                      style={{
                        color: MUTED,
                        fontFamily: "var(--font-sans)",
                        fontSize: "12px",
                        lineHeight: 1.4,
                      }}
                    >
                      {m.copy}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Three-card decision. Primary path = book a walkthrough; that's
          Norman's call (2026-06-02) for the trial wizard's terminal
          CTA. Secondary = pilot (also a sales conversation). Tertiary
          = continue trial, muted styling so it doesn't compete. */}
      <section>
        <p
          style={{
            color: INK,
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Choose your path
        </p>

        <div className="mt-3 space-y-2.5">
          {/* PRIMARY: Book a walkthrough */}
          <button
            type="button"
            onClick={cal.open}
            disabled={disabled || !cal.isAvailable}
            className="w-full text-left rounded-xl transition-colors flex items-start gap-3"
            style={{
              padding: "16px 18px",
              border: `1.5px solid ${ACCENT}`,
              backgroundColor: ACCENT,
              color: "#FFFFFF",
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <Calendar
              className="w-5 h-5 shrink-0 mt-0.5"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="flex-1 min-w-0">
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "15.5px",
                  fontWeight: 600,
                  display: "block",
                  letterSpacing: "-0.012em",
                }}
              >
                Book a 30-min walkthrough
              </span>
              <span
                className="mt-1 block"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  lineHeight: 1.45,
                  opacity: 0.86,
                }}
              >
                Norman or someone on the LeaseStack team walks you through
                the platform live. Recommended if you have specific
                questions about your portfolio.
              </span>
            </span>
          </button>

          {/* SECONDARY: Request a pilot — same Cal modal because both
              paths route to a sales conversation. Distinct copy so
              operators self-select. */}
          <button
            type="button"
            onClick={cal.open}
            disabled={disabled || !cal.isAvailable}
            className="w-full text-left rounded-xl transition-colors flex items-start gap-3"
            style={{
              padding: "16px 18px",
              border: `1px solid ${BORDER}`,
              backgroundColor: "#FFFFFF",
              color: INK,
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <Handshake
              className="w-5 h-5 shrink-0 mt-0.5"
              strokeWidth={1.75}
              style={{ color: ACCENT }}
              aria-hidden="true"
            />
            <span className="flex-1 min-w-0">
              <span
                style={{
                  color: INK,
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  fontWeight: 600,
                  display: "block",
                  letterSpacing: "-0.012em",
                }}
              >
                Request a paid pilot
              </span>
              <span
                className="mt-1 block"
                style={{
                  color: MUTED,
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  lineHeight: 1.45,
                }}
              >
                Set up a 30-60 day paid pilot tailored to your portfolio
                — custom pricing, onboarding support, and a dedicated
                success contact. Best for operators with 3+ properties.
              </span>
            </span>
          </button>

          {/* TERTIARY: Continue with free trial. Muted styling so it
              doesn't visually compete with the two sales paths — but
              still fully functional for self-serve trialers. */}
          <button
            type="button"
            onClick={handleStartTrial}
            disabled={disabled}
            className="w-full text-left rounded-xl transition-colors flex items-start gap-3 hover:bg-[#F8FAFC]"
            style={{
              padding: "14px 18px",
              border: `1px dashed ${BORDER}`,
              backgroundColor: "#FFFFFF",
              color: INK,
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <Sparkles
              className="w-4 h-4 shrink-0 mt-0.5"
              strokeWidth={1.75}
              style={{ color: MUTED }}
              aria-hidden="true"
            />
            <span className="flex-1 min-w-0">
              <span
                style={{
                  color: INK,
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  fontWeight: 600,
                  display: "block",
                  letterSpacing: "-0.008em",
                }}
              >
                Continue with the 14-day free trial
              </span>
              <span
                className="mt-0.5 block"
                style={{
                  color: MUTED,
                  fontFamily: "var(--font-sans)",
                  fontSize: "12.5px",
                  lineHeight: 1.4,
                }}
              >
                No card. Self-serve. Pick this if you want to poke around
                first and talk later.
              </span>
            </span>
          </button>
        </div>

        {!cal.isAvailable ? (
          <p
            className="mt-3"
            style={{
              color: MUTED,
              fontFamily: "var(--font-sans)",
              fontSize: "11.5px",
              lineHeight: 1.4,
            }}
          >
            Booking opens in a moment — if it doesn&rsquo;t, refresh and try
            again or email{" "}
            <a
              href="mailto:hello@leasestack.co"
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              hello@leasestack.co
            </a>
            .
          </p>
        ) : null}
      </section>
    </div>
  );
}
