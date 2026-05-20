// ---------------------------------------------------------------------------
// Popup template library.
//
// Operator picks one of these when they click "New popup". The selected
// template's `defaults` get merged into the new PopupCampaign row so the
// preview is polished from the very first save.
//
// Templates are data-only. The renderer (public/embed/popup.js) and the
// React preview (components/portal/popups/popup-preview.tsx) both consume
// the SAME PopupCampaign shape — the template is just a seed for that
// shape, not a separate rendering codepath.
//
// All fields here are optional in the DB; rows created from a template
// store the template's slug in `template` so the editor can show a
// "Reset to template defaults" affordance + the analytics surface can
// group performance by template.
// ---------------------------------------------------------------------------

import {
  PopupPosition,
  PopupStatus,
  PopupTheme,
  PopupTrigger,
} from "@prisma/client";

/**
 * The subset of PopupCampaign fields a template is allowed to seed.
 * Mirrors the editor's PopupEditorInitial type so the same defaults can
 * flow into the create-action AND into the editor's hydration step.
 *
 * Stored as a plain object (not Prisma's input type) because the
 * server action accepts the raw fields directly via zod parsing.
 */
export type PopupIconSlug =
  | "calendar"
  | "phone"
  | "external"
  | "arrow"
  | "none";

export type PopupTemplateDefaults = {
  name: string;
  status?: PopupStatus;
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  offerCode?: string | null;
  secondaryText?: string | null;
  trigger: PopupTrigger;
  triggerThreshold: number;
  targetUrlPatterns?: string[];
  frequency?: string;
  position: PopupPosition;
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
  heroImageUrl?: string | null;
  captureEmail: boolean;
  capturePhone: boolean;
  eyebrowText?: string | null;
  accentColor?: string | null;
  theme: PopupTheme;
  template: string;
  featuredLabel?: string | null;
  featuredValue?: string | null;
  featuredUnit?: string | null;
  featuredCaption?: string | null;
  secondaryCtaText?: string | null;
  secondaryCtaUrl?: string | null;
  secondaryCtaIcon?: PopupIconSlug | null;
  primaryCtaIcon?: PopupIconSlug | null;
  dismissText?: string | null;
  gradientColors?: string[] | null;
};

export type PopupTemplate = {
  id: string;
  label: string;
  description: string;
  /** A 1-line accent shown on the picker card (e.g. "Dark, dual CTA"). */
  badge: string;
  defaults: PopupTemplateDefaults;
};

// ─── Templates ──────────────────────────────────────────────────────────

const limitedAvailability: PopupTemplate = {
  id: "limited-availability",
  label: "Limited availability",
  description:
    "Dark, premium leasing announcement with a featured rate card and dual CTAs. Use to drive applications when units are tight.",
  badge: "Dark · dual CTA · featured rate",
  defaults: {
    name: "Limited availability",
    template: "limited-availability",
    status: PopupStatus.DRAFT,
    eyebrowText: "LIMITED AVAILABILITY",
    headline: "Now Leasing for 2026-2027",
    body: "A handful of premium units remain for the upcoming lease year. Lock in your home before they're gone.",
    ctaText: "Check Availability",
    ctaUrl: "/floor-plans",
    primaryCtaIcon: "external",
    secondaryCtaText: "Schedule Tour",
    secondaryCtaUrl: "/tour",
    secondaryCtaIcon: "calendar",
    dismissText: "Not yet, thanks",
    trigger: PopupTrigger.TIME_ON_PAGE,
    triggerThreshold: 8,
    frequency: "session",
    position: PopupPosition.CENTER,
    theme: PopupTheme.DARK,
    primaryColor: "#F5BC1A", // warm gold — primary button + featured value
    textColor: "#FFFFFF",
    backgroundColor: "#0F1729", // deep navy
    accentColor: "#F5BC1A",
    featuredLabel: "RATES AS LOW AS",
    featuredValue: "$765",
    featuredUnit: "/mo",
    featuredCaption: "+ $85/mo amenity fee",
    gradientColors: ["#F5BC1A", "#EC4899", "#3B82F6"],
    captureEmail: false,
    capturePhone: false,
  },
};

const tourPush: PopupTemplate = {
  id: "tour-push",
  label: "Tour push",
  description:
    "Single-CTA prompt to book a tour. Light, friendly, fires after 15 seconds of browsing.",
  badge: "Light · book a tour",
  defaults: {
    name: "Schedule a tour",
    template: "tour-push",
    status: PopupStatus.DRAFT,
    eyebrowText: "SEE IT FIRST",
    headline: "See it in person",
    body: "Photos only go so far. Book a 15-minute tour and we'll show you the unit, the amenities, and the neighborhood.",
    ctaText: "Schedule a tour",
    ctaUrl: "/tour",
    primaryCtaIcon: "calendar",
    dismissText: "Maybe later",
    trigger: PopupTrigger.TIME_ON_PAGE,
    triggerThreshold: 15,
    frequency: "session",
    position: PopupPosition.CENTER,
    theme: PopupTheme.LIGHT,
    primaryColor: "#2563EB",
    textColor: "#0F172A",
    backgroundColor: "#FFFFFF",
    accentColor: "#2563EB",
    captureEmail: false,
    capturePhone: false,
  },
};

const exitSave: PopupTemplate = {
  id: "exit-save",
  label: "Exit save",
  description:
    "Catches visitors heading for the exit with a soft, helpful nudge. Email capture pre-enabled.",
  badge: "Light · exit intent · email",
  defaults: {
    name: "Exit save",
    template: "exit-save",
    status: PopupStatus.DRAFT,
    eyebrowText: "WAIT — DON'T GO",
    headline: "We've got a unit that might be perfect for you",
    body: "Tell us what you're looking for and we'll send a short list of openings that match before you leave.",
    ctaText: "Send me matches",
    ctaUrl: "#",
    primaryCtaIcon: "arrow",
    dismissText: "No thanks, I'll keep browsing",
    trigger: PopupTrigger.EXIT_INTENT,
    triggerThreshold: 0,
    frequency: "session",
    position: PopupPosition.CENTER,
    theme: PopupTheme.LIGHT,
    primaryColor: "#0F172A",
    textColor: "#0F172A",
    backgroundColor: "#FFFFFF",
    accentColor: "#0F172A",
    captureEmail: true,
    capturePhone: false,
  },
};

const referral: PopupTemplate = {
  id: "referral",
  label: "Referral offer",
  description:
    "Bottom-right toast that asks current residents (or warm leads) to refer a friend for a credit.",
  badge: "Toast · offer code · low friction",
  defaults: {
    name: "Refer a friend",
    template: "referral",
    status: PopupStatus.DRAFT,
    eyebrowText: "RESIDENT REWARDS",
    headline: "Refer a friend, get $250",
    body: "Send a friend your way. When they sign a lease, we'll credit $250 toward your next month's rent.",
    ctaText: "Get my referral link",
    ctaUrl: "/refer",
    primaryCtaIcon: "external",
    offerCode: "FRIEND250",
    dismissText: "Not right now",
    trigger: PopupTrigger.TIME_ON_PAGE,
    triggerThreshold: 30,
    frequency: "once_per_day",
    position: PopupPosition.BOTTOM_RIGHT,
    theme: PopupTheme.LIGHT,
    primaryColor: "#16A34A",
    textColor: "#0F172A",
    backgroundColor: "#FFFFFF",
    accentColor: "#16A34A",
    captureEmail: false,
    capturePhone: false,
  },
};

export const POPUP_TEMPLATES: readonly PopupTemplate[] = [
  limitedAvailability,
  tourPush,
  exitSave,
  referral,
] as const;

export function getPopupTemplate(id: string | null | undefined): PopupTemplate | null {
  if (!id) return null;
  return POPUP_TEMPLATES.find((t) => t.id === id) ?? null;
}
