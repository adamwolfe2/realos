// Digital Performance Score quiz. Question schema.
//
// Single source of truth for the /audit quiz. Both the client UI
// (`components/audit/digital-score-quiz.tsx`) and the scoring +
// recommendation engines (`lib/audit/scoring.ts`,
// `lib/audit/recommendations.ts`) consume this file so question IDs,
// choice IDs, and pillar mappings stay aligned across the system.
//
// Design rules (Adam 2026-06-01):
// - 6-9 questions max. Each must capture a signal the SEO/AEO/
//   reputation scanner cannot read on its own, OR a signal that drives
//   a specific LeaseStack feature recommendation.
// - Every question maps to >=1 pillar AND to >=1 feature so the result
//   page can render "you said X, here's the LeaseStack fix."
// - The final question is always the property website URL. The scan
//   can't start without it.

export type Pillar =
  | "findability"
  | "reputation"
  | "conversion"
  | "tracking"
  | "accessibility"
  | "listings";

export const PILLAR_LABELS: Record<Pillar, string> = {
  findability: "Findability",
  reputation: "Reputation",
  conversion: "Conversion infrastructure",
  tracking: "Tracking & attribution",
  accessibility: "Accessibility & speed",
  listings: "Listing presence",
};

export const PILLAR_WEIGHTS: Record<Pillar, number> = {
  findability: 0.25,
  reputation: 0.2,
  conversion: 0.2,
  tracking: 0.15,
  accessibility: 0.1,
  listings: 0.1,
};

// Hard caps per pillar. Per Adam 2026-06-01: "We never want to give
// anyone a score over 75." Each pillar caps below 100 so the weighted
// overall lands well under that ceiling regardless of raw signals.
// Caps reflect the reality that without LeaseStack, every pillar has a
// structural gap (no chatbot/popups, no pixel, listings not portfolio-
// managed, etc).
export const PILLAR_CAPS: Record<Pillar, number> = {
  findability: 70,
  reputation: 80,
  conversion: 65,
  tracking: 60,
  accessibility: 90,
  listings: 75,
};

// Overall DPS hard ceiling. Even if the weighted sum somehow lands
// higher (which it shouldn't given pillar caps), this clamps it.
export const OVERALL_DPS_CAP = 75;

// Sanity check. Pillar weights must sum to 1. A drift in this file
// would silently warp every DPS computation, so we fail fast at module
// load instead of at scoring time.
const WEIGHT_SUM = Object.values(PILLAR_WEIGHTS).reduce((s, w) => s + w, 0);
if (Math.abs(WEIGHT_SUM - 1) > 0.0001) {
  throw new Error(
    `[quiz-questions] PILLAR_WEIGHTS must sum to 1, got ${WEIGHT_SUM}`,
  );
}

export type QuestionKind = "single" | "multi" | "url";

export interface Choice {
  id: string;
  label: string;
  // Optional sub-label rendered under the choice label for context.
  hint?: string;
}

export interface Question {
  id: string;
  kind: QuestionKind;
  prompt: string;
  helper?: string;
  pillars: Pillar[];
  required: boolean;
  // Only used by `single` and `multi` questions.
  choices?: Choice[];
  // Free-text placeholder, only used by `url`.
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Question set v2. 8 questions
// ---------------------------------------------------------------------------

export const QUIZ_QUESTIONS: Question[] = [
  {
    id: "property_type",
    kind: "single",
    prompt: "What kind of property are you marketing?",
    helper:
      "We tune benchmarks and action items to the asset class. Student, conventional, senior, and commercial all read very differently.",
    pillars: ["findability", "listings"],
    required: true,
    choices: [
      { id: "student", label: "Student housing" },
      { id: "multifamily", label: "Conventional multifamily" },
      { id: "affordable", label: "Affordable housing" },
      { id: "senior", label: "Senior living" },
      { id: "commercial", label: "Commercial / mixed-use" },
      { id: "office", label: "Office" },
      { id: "industrial", label: "Industrial" },
      { id: "mixed", label: "A mix of the above" },
    ],
  },
  {
    id: "portfolio_size",
    kind: "single",
    prompt: "How big is the portfolio you're managing?",
    helper:
      "Single property vs. A portfolio of fifty changes the gap analysis entirely. Single-asset operators feel different pain than multi-property leadership.",
    pillars: ["tracking", "listings"],
    required: true,
    choices: [
      { id: "single", label: "1 property" },
      { id: "small", label: "2–10 properties" },
      { id: "mid", label: "11–50 properties" },
      { id: "large", label: "50+ properties" },
    ],
  },
  {
    id: "tour_booking",
    kind: "single",
    prompt: "How does a prospect actually book a tour today?",
    helper:
      "The path from 'curious' to 'on the calendar' is where most properties leak the most leads.",
    pillars: ["conversion"],
    required: true,
    choices: [
      {
        id: "self_serve",
        label: "Online self-serve booking",
        hint: "They pick a slot themselves",
      },
      {
        id: "form_callback",
        label: "Form, then we call them back",
      },
      {
        id: "call_only",
        label: "Phone call only",
      },
      {
        id: "unclear",
        label: "Honestly, no clear path",
      },
    ],
  },
  {
    id: "site_features",
    kind: "multi",
    prompt: "Which of these are live on your property site right now?",
    helper: "Pick everything that's actually deployed. Not what's planned.",
    pillars: ["conversion", "tracking"],
    required: false,
    choices: [
      { id: "live_chat", label: "Live chat with a human" },
      { id: "ai_chatbot", label: "AI chatbot" },
      { id: "calendly_link", label: "Calendly link" },
      { id: "popups", label: "Exit / intent popups" },
      { id: "visitor_pixel", label: "Visitor pixel" },
      { id: "floorplan_tool", label: "Interactive floor plan / unit picker" },
      { id: "online_application", label: "Online application form" },
      { id: "virtual_tour", label: "Virtual tour / 3D walkthrough" },
      { id: "none_of_these", label: "None of these" },
    ],
  },
  {
    id: "reputation_handling",
    kind: "single",
    prompt: "How are you handling online reviews and reputation today?",
    helper:
      "A property's reputation is the single biggest lever on tour-to-lease. And the easiest one to neglect.",
    pillars: ["reputation"],
    required: true,
    choices: [
      {
        id: "auto_monitored",
        label: "Auto-monitored, alerts on every new mention",
        hint: "Yelp, Google, Reddit, ApartmentRatings, etc.",
      },
      {
        id: "monthly_check",
        label: "We check the major sites monthly",
      },
      {
        id: "occasional",
        label: "Occasionally. When something flares up",
      },
      {
        id: "not_at_all",
        label: "Not really watching this",
      },
    ],
  },
  {
    id: "lead_sources",
    kind: "multi",
    prompt: "Where do your leads come from today?",
    helper:
      "Pick everything that contributes. Paid, organic, ILS, referrals. We'll verify what's live during the scan.",
    pillars: ["listings", "tracking"],
    required: false,
    choices: [
      { id: "loopnet_costar", label: "LoopNet / CoStar" },
      { id: "paid_ads", label: "Paid ads (Meta, Google, TikTok)" },
      { id: "apartments_com", label: "Apartments.com" },
      { id: "zillow", label: "Zillow / Trulia / Rent." },
      { id: "broker_direct", label: "Broker direct" },
      { id: "google_search", label: "Google search / Google Business" },
      { id: "ai_search", label: "ChatGPT / Perplexity / AI search" },
      { id: "referrals", label: "Resident referrals & walk-ins" },
      { id: "phone_calls", label: "Phone calls" },
      { id: "not_sure", label: "Honestly, we don't know" },
      { id: "other", label: "Other" },
    ],
  },
  {
    id: "marketing_tracking",
    kind: "single",
    prompt: "How do you track marketing performance today?",
    helper:
      "If you can't tell which channel filled a unit last month, neither can the renter who's about to ghost you.",
    pillars: ["tracking"],
    required: true,
    choices: [
      {
        id: "pixel_plus_analytics",
        label: "Visitor pixel + analytics",
        hint: "We see who's actually browsing",
      },
      {
        id: "ga_only",
        label: "Google Analytics only",
      },
      {
        id: "crm_only",
        label: "Our CRM tracks leads, that's it",
      },
      {
        id: "no_tracking",
        label: "We don't really track this",
      },
    ],
  },
  {
    id: "domain",
    kind: "url",
    prompt: "What's your property website?",
    helper:
      "We'll pull live SEO, AI search, and reputation data on this domain in the next ~60 seconds.",
    pillars: [
      "findability",
      "reputation",
      "conversion",
      "tracking",
      "accessibility",
      "listings",
    ],
    required: true,
    placeholder: "yourproperty.com",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shape of a completed quiz, persisted on ProspectAudit.quizAnswers. */
export interface QuizAnswers {
  // Map of question.id -> answer. Single-choice = choice.id string,
  // multi-choice = array of choice.id, url = the URL string.
  [questionId: string]: string | string[];
}

/**
 * True when every required question in the set has a non-empty answer.
 * Multi-select questions are non-required by design, so an empty array
 * is acceptable for those.
 */
export function isQuizComplete(answers: QuizAnswers): boolean {
  for (const q of QUIZ_QUESTIONS) {
    if (!q.required) continue;
    const a = answers[q.id];
    if (a === undefined || a === null) return false;
    if (typeof a === "string" && a.trim() === "") return false;
    if (Array.isArray(a) && a.length === 0) return false;
  }
  return true;
}

/** Locate the URL answer (always present on a complete quiz). */
export function getDomainAnswer(answers: QuizAnswers): string | null {
  const v = answers["domain"];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Typed answer readers. Keep callers from sprinkling string-key
 *  lookups across the codebase. Returns `null` when the answer isn't
 *  present (e.g. Anonymous URL-only submit). */
export function readSingleAnswer<T extends string = string>(
  answers: QuizAnswers | null | undefined,
  id: string,
): T | null {
  if (!answers) return null;
  const v = answers[id];
  return typeof v === "string" && v.trim() !== "" ? (v as T) : null;
}

export function readMultiAnswer(
  answers: QuizAnswers | null | undefined,
  id: string,
): string[] {
  if (!answers) return [];
  const v = answers[id];
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
