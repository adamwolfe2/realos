import "server-only";

// ---------------------------------------------------------------------------
// Marketplace lead scoring
//
// Takes a raw Cursive segment-member payload and returns a 0–100 composite
// intent score plus a normalized set of fields the marketplace browse UI
// renders (signal line, timeline label, budget label).
//
// The score combines five weighted dimensions:
//
//   1. Recency       (0–25)  — how recently this profile was seen active
//   2. Search depth  (0–25)  — listings viewed in the last 7 days
//   3. Segment fit   (0–20)  — how many active-buyer / mover / rental
//                              intent segments this profile is in
//   4. Verification  (0–15)  — verified email + phone + address bonuses
//   5. Urgency       (0–15)  — explicit timeline signals (mortgage pre-app,
//                              tour scheduled, distressed, relocation)
//
// The function is pure and deterministic — same input always produces the
// same output. Easy to unit-test and easy to backfill historical leads.
// ---------------------------------------------------------------------------

export type RawIntentPayload = {
  // Pulled from Cursive AlMember or equivalent
  profileId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  age?: number;
  city?: string;
  state?: string;
  postalCode?: string;

  // Behaviour / intent
  segments?: string[];                  // ["Active Home Buyer", "Refinance Intent", ...]
  listingsViewed7d?: number;
  lastSeenAt?: string | Date | null;
  searchRadius?: string;                // "Brooklyn · Park Slope · Gowanus"

  // Strong-signal flags
  hasMortgagePreApp?: boolean;
  hasScheduledTour?: boolean;
  hasCashBuyerSignal?: boolean;
  isRelocating?: boolean;
  isDistressed?: boolean;
  isLeaseEndingSoon?: boolean;
  toursScheduled?: number;

  // Budget signals
  budgetMinCents?: number;
  budgetMaxCents?: number;
  budgetUnit?: "ABS" | "MONTHLY";       // ABS = sale price, MONTHLY = rent

  // Verification
  emailVerified?: boolean;
  phoneVerified?: boolean;
  addressVerified?: boolean;
};

export type ScoringOutcome = {
  intentScore: number;             // 0..100, clamped
  signal: string;                  // single-line behavioural summary
  timeline: string;                // "0–14 days", "30–60 days", etc.
  budgetLabel: string | null;      // pretty-printed budget range
  isHot: boolean;                  // intent ≥ 85
};

const DAYS = 24 * 60 * 60 * 1000;

export function scoreLead(p: RawIntentPayload): ScoringOutcome {
  const intentScore = clamp(
    recencyComponent(p) +
      searchDepthComponent(p) +
      segmentFitComponent(p) +
      verificationComponent(p) +
      urgencyComponent(p),
    0,
    100,
  );

  return {
    intentScore,
    signal: pickSignal(p),
    timeline: pickTimeline(p),
    budgetLabel: formatBudget(p),
    isHot: intentScore >= 85,
  };
}

// ---------------------------------------------------------------------------
// Component scorers — each returns a non-negative integer bounded by its cap.

function recencyComponent(p: RawIntentPayload): number {
  if (!p.lastSeenAt) return 0;
  const seen = new Date(p.lastSeenAt).getTime();
  if (Number.isNaN(seen)) return 0;
  const ageDays = (Date.now() - seen) / DAYS;
  if (ageDays <= 1) return 25;
  if (ageDays <= 3) return 22;
  if (ageDays <= 7) return 18;
  if (ageDays <= 14) return 12;
  if (ageDays <= 30) return 6;
  return 0;
}

function searchDepthComponent(p: RawIntentPayload): number {
  const v = p.listingsViewed7d ?? 0;
  if (v >= 25) return 25;
  if (v >= 15) return 20;
  if (v >= 8) return 14;
  if (v >= 3) return 8;
  if (v >= 1) return 4;
  return 0;
}

function segmentFitComponent(p: RawIntentPayload): number {
  const segs = (p.segments ?? []).map((s) => s.toLowerCase());
  if (segs.length === 0) return 0;
  let score = 0;
  const has = (needle: string) => segs.some((s) => s.includes(needle));

  if (has("active home buyer") || has("active homebuyer")) score += 8;
  if (has("refinance")) score += 4;
  if (has("relocat")) score += 5;
  if (has("first time") || has("first-time")) score += 4;
  if (has("luxury")) score += 4;
  if (has("investor") || has("investment")) score += 5;
  if (has("distressed")) score += 6;
  if (has("lease ending") || has("renter")) score += 4;
  if (has("cash buyer")) score += 6;

  return Math.min(score, 20);
}

function verificationComponent(p: RawIntentPayload): number {
  let score = 0;
  if (p.emailVerified) score += 5;
  if (p.phoneVerified) score += 6;
  if (p.addressVerified) score += 4;
  return Math.min(score, 15);
}

function urgencyComponent(p: RawIntentPayload): number {
  let score = 0;
  if (p.hasMortgagePreApp) score += 7;
  if (p.hasCashBuyerSignal) score += 6;
  if (p.hasScheduledTour) score += 5;
  if ((p.toursScheduled ?? 0) >= 3) score += 3;
  if (p.isRelocating) score += 3;
  if (p.isDistressed) score += 5;
  if (p.isLeaseEndingSoon) score += 3;
  return Math.min(score, 15);
}

// ---------------------------------------------------------------------------
// Human-readable labels derived from the same payload, used by the browse UI.

function pickSignal(p: RawIntentPayload): string {
  if (p.hasMortgagePreApp) return "Mortgage pre-app · recent";
  if (p.hasCashBuyerSignal) return "Cash buyer signal";
  if ((p.toursScheduled ?? 0) >= 3) return `${p.toursScheduled} tours scheduled`;
  if (p.hasScheduledTour) return "Tour scheduled";
  if (p.isDistressed) return "Distressed-property search";
  if (p.isRelocating) return "Relocation · job offer";
  if (p.isLeaseEndingSoon) return "Lease ending soon";
  const v = p.listingsViewed7d ?? 0;
  if (v >= 1) return `Viewed ${v} listings · 7d`;
  return "Active in segment";
}

function pickTimeline(p: RawIntentPayload): string {
  // Urgency signals take precedence over recency-based heuristics.
  if (p.isDistressed || p.hasCashBuyerSignal) return "0–45 days";
  if (p.hasMortgagePreApp) return "0–30 days";
  if (p.hasScheduledTour || p.isLeaseEndingSoon) return "0–21 days";
  if (p.isRelocating) return "30–60 days";
  const v = p.listingsViewed7d ?? 0;
  if (v >= 20) return "0–14 days";
  if (v >= 10) return "0–30 days";
  if (v >= 3) return "30–60 days";
  return "30–90 days";
}

function formatBudget(p: RawIntentPayload): string | null {
  if (p.budgetMinCents == null && p.budgetMaxCents == null) return null;
  const min = p.budgetMinCents ?? p.budgetMaxCents ?? 0;
  const max = p.budgetMaxCents ?? p.budgetMinCents ?? 0;
  const unit = p.budgetUnit ?? "ABS";
  if (unit === "MONTHLY") {
    return `${formatMonthly(min)} – ${formatMonthly(max)}/mo`;
  }
  return `${formatAbsolute(min)} – ${formatAbsolute(max)}`;
}

function formatMonthly(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

function formatAbsolute(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1000) return `$${Math.round(dollars / 1000)}K`;
  return `$${dollars.toFixed(0)}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}
