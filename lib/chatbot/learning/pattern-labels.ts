// Plain-English labels for knowledge-suggestion patternType values. The
// learning engine (engine.ts) writes the snake_case keys; the UPPER_CASE
// keys are learning-case types some older/demo rows carry.

const PATTERN_LABEL: Record<string, { title: string; reason: string }> = {
  weak_cta_human_contact_punt: {
    title: "Sent to leasing with no next step",
    reason: "the chatbot sent renters to the leasing office without a next step",
  },
  capture_after_pricing_or_availability: {
    title: "Left without contact info",
    reason: "renters asked about price or availability and left without contact info",
  },
  PRICING_QUESTION_NO_CAPTURE: { title: "Pricing question, no contact info", reason: "renters asked about price and left" },
  AVAILABILITY_QUESTION_NO_CAPTURE: { title: "Availability question, no contact info", reason: "availability questions went unanswered" },
  TOUR_INTENT_NO_TOUR: { title: "Tour request never booked", reason: "tour requests never booked" },
  APPLICATION_HELP_NEEDED: { title: "Stuck on the application", reason: "prospects got stuck on the application" },
  BOT_FALLBACK_PATTERN: { title: "Chatbot could not answer", reason: "the chatbot could not answer" },
};

/** Short title for a fix, e.g. "Left without contact info". */
export function patternTitle(patternType: string): string {
  const known = PATTERN_LABEL[patternType]?.title;
  if (known) return known;
  const t = patternType.replaceAll("_", " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Clause for "after N chats where …". */
export function patternReason(patternType: string): string {
  return PATTERN_LABEL[patternType]?.reason ?? "the answer was missing";
}
