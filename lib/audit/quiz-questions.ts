// Digital Performance Score quiz — question schema.
//
// Single source of truth for the /audit quiz. Both the client UI
// (`components/audit/digital-score-quiz.tsx`) and the future scoring engine
// (`lib/audit/scoring.ts`) consume this file so question IDs, choice IDs,
// and pillar mappings stay aligned across the system.
//
// Design rules (Adam 2026-06-01):
// - 5-7 questions max. Each must capture a signal the SEO/AEO/reputation
//   scanner cannot read on its own.
// - Every question maps to >=1 pillar so we can show "Q3 -> Conversion"
//   reasoning when rendering action items.
// - The final question is always the property website URL — the scan can't
//   start without it.

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

// Sanity check — pillar weights must sum to 1. A drift in this file
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
// Question set v1 — 6 questions
// ---------------------------------------------------------------------------

export const QUIZ_QUESTIONS: Question[] = [
  {
    id: "property_type",
    kind: "single",
    prompt: "What kind of property are you marketing?",
    helper:
      "We tune benchmarks and action items to the asset class — student, conventional, senior, and commercial all read very differently.",
    pillars: ["findability", "listings"],
    required: true,
    choices: [
      { id: "student", label: "Student housing" },
      { id: "multifamily", label: "Conventional multifamily" },
      { id: "senior", label: "Senior living" },
      { id: "commercial", label: "Commercial / mixed-use" },
      { id: "mixed", label: "A mix of the above" },
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
    helper: "Pick everything that's actually deployed — not what's planned.",
    pillars: ["conversion", "tracking"],
    required: false,
    choices: [
      { id: "live_chat", label: "Live chat with a human" },
      { id: "ai_chatbot", label: "AI chatbot" },
      { id: "floorplan_tool", label: "Interactive floor plan / unit picker" },
      { id: "online_application", label: "Online application form" },
      { id: "virtual_tour", label: "Virtual tour / 3D walkthrough" },
      { id: "none_of_these", label: "None of these" },
    ],
  },
  {
    id: "listing_platforms",
    kind: "multi",
    prompt: "Where else does this property show up?",
    helper:
      "The platforms a renter actually checks. We'll separately verify what's live during the scan.",
    pillars: ["listings", "reputation"],
    required: false,
    choices: [
      { id: "apartments_com", label: "Apartments.com" },
      { id: "zillow", label: "Zillow / Trulia" },
      { id: "rent_com", label: "Rent." },
      { id: "apartmentratings", label: "ApartmentRatings" },
      { id: "google_business", label: "Google Business Profile" },
      { id: "none", label: "None / not sure" },
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
