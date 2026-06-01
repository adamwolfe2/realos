// Scoring engine — turns the raw SignalSnapshot + the operator's quiz
// answers into the 6 pillar sub-scores and the overall Digital
// Performance Score (DPS) the audit result page renders.
//
// Caps are enforced here (Adam 2026-06-01): no operator can ever score
// above 75 overall, and every pillar has its own ceiling that reflects
// the structural gap a non-LeaseStack property has. The point of the
// audit is to find gaps — a "100/100" reading defeats the purpose.

import type { SignalSnapshot } from "@/lib/signals/types";
import {
  OVERALL_DPS_CAP,
  PILLAR_CAPS,
  PILLAR_WEIGHTS,
  readMultiAnswer,
  readSingleAnswer,
  type Pillar,
  type QuizAnswers,
} from "./quiz-questions";

export interface PillarScore {
  /** 0-100, post-cap. The number we render. */
  score: number;
  /** The hard cap that applied. */
  cap: number;
  /** Short "what your score means" headline. */
  headline: string;
  /** "Why we capped this" copy — null if score is below the cap. */
  capReason: string | null;
  /** Short bullet supporting points, derived from real signals/quiz. */
  points: string[];
}

export type PillarScores = Record<Pillar, PillarScore>;

export interface DpsResult {
  /** 0-100, post-cap. */
  score: number;
  /** Active cap. */
  cap: number;
  /** Always set — explains the ceiling so the prospect understands the
   *  number is a structural ceiling, not arbitrary. */
  capReason: string;
  pillars: PillarScores;
}

/** Lighthouse-derived inputs the scoring engine needs alongside the
 *  rolled-up SignalSnapshot. Caller assembles from provider data. */
export interface ScoringInputs {
  /** Lighthouse SEO category 0-100, or null if unavailable. */
  lighthouseSeo: number | null;
  /** Lighthouse Performance category 0-100, or null. */
  lighthousePerformance: number | null;
  /** Lighthouse Accessibility category 0-100, or null. */
  lighthouseAccessibility: number | null;
  /** True when schema.org structured data is detected on the homepage. */
  hasSchemaMarkup: boolean;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function computeDps(
  snapshot: SignalSnapshot,
  inputs: ScoringInputs,
  quiz: QuizAnswers | null,
): DpsResult {
  const pillars: PillarScores = {
    findability: computeFindability(snapshot, inputs),
    reputation: computeReputation(snapshot, quiz),
    conversion: computeConversion(quiz, inputs),
    tracking: computeTracking(quiz),
    accessibility: computeAccessibility(inputs),
    listings: computeListings(snapshot, quiz),
  };

  // Weighted DPS, then hard ceiling.
  const weighted =
    pillars.findability.score * PILLAR_WEIGHTS.findability +
    pillars.reputation.score * PILLAR_WEIGHTS.reputation +
    pillars.conversion.score * PILLAR_WEIGHTS.conversion +
    pillars.tracking.score * PILLAR_WEIGHTS.tracking +
    pillars.accessibility.score * PILLAR_WEIGHTS.accessibility +
    pillars.listings.score * PILLAR_WEIGHTS.listings;
  const score = clamp(Math.round(weighted), 0, OVERALL_DPS_CAP);

  return {
    score,
    cap: OVERALL_DPS_CAP,
    capReason:
      "Even the most polished operator stops at 75 — every property has structural ceilings on AI search reach, tracking, and review velocity until they're actively managed.",
    pillars,
  };
}

// ---------------------------------------------------------------------------
// Pillars
// ---------------------------------------------------------------------------

// SEO sub-cap inside the Findability pillar. Strong fundamentals max at
// 85; without LeaseStack's keyword-trends + AEO management the rest is
// structural ceiling.
const SEO_SUBCAP = 85;
// AEO sub-cap — until you're cited by all 4 engines AND have a
// knowledge graph entry, AEO is by definition unfinished.
const AEO_SUBCAP = 60;

function computeFindability(
  snapshot: SignalSnapshot,
  inputs: ScoringInputs,
): PillarScore {
  // Components: SEO (50%) + AEO (50%). Each capped at its sub-ceiling
  // before averaging so a perfect SEO can't paper over a low AEO.
  const rawSeo = snapshot.seo?.score ?? inputs.lighthouseSeo ?? 50;
  const rawAeo = snapshot.aeo?.score ?? 30;
  const seo = clamp(rawSeo, 0, SEO_SUBCAP);
  const aeo = clamp(rawAeo, 0, AEO_SUBCAP);
  const composite = Math.round(seo * 0.5 + aeo * 0.5);
  const score = clamp(composite, 0, PILLAR_CAPS.findability);

  const points: string[] = [];
  if (snapshot.seo?.organicKeywords) {
    points.push(
      `${snapshot.seo.organicKeywords.toLocaleString()} ranked keyword${snapshot.seo.organicKeywords === 1 ? "" : "s"}, ${snapshot.seo.top10Count} in Google's top 10.`,
    );
  }
  if (inputs.lighthouseSeo != null) {
    points.push(`Lighthouse SEO category: ${inputs.lighthouseSeo}/100.`);
  }
  if (snapshot.aeo) {
    points.push(
      `${snapshot.aeo.citationsFound} of ${snapshot.aeo.enginesChecked} AI engines cite the brand by name.`,
    );
  }
  if (!inputs.hasSchemaMarkup) {
    points.push("No schema.org markup detected — limits AI engine confidence.");
  }
  return {
    score,
    cap: PILLAR_CAPS.findability,
    headline: pickFindabilityHeadline(score),
    capReason:
      score >= PILLAR_CAPS.findability
        ? `Findability tops out at ${PILLAR_CAPS.findability} — SEO sub-caps at ${SEO_SUBCAP}, AEO sub-caps at ${AEO_SUBCAP}. Both have continuous headroom only LeaseStack's keyword-trends + AEO management close.`
        : null,
    points: points.slice(0, 4),
  };
}

function pickFindabilityHeadline(score: number): string {
  if (score >= 60) return "Strong, but ceiling-limited";
  if (score >= 40) return "Healthy SEO with AEO gaps";
  if (score >= 20) return "Significant findability work needed";
  return "Largely invisible online";
}

function computeReputation(
  snapshot: SignalSnapshot,
  quiz: QuizAnswers | null,
): PillarScore {
  const rep = snapshot.reputation;
  const handling = readSingleAnswer(quiz, "reputation_handling");

  let base = rep?.score ?? 45;
  // Operators that aren't watching reviews get a real penalty — the
  // signal isn't whether reviews EXIST, it's whether anyone's at the
  // wheel when one lands.
  if (handling === "not_at_all") base -= 20;
  else if (handling === "occasional") base -= 10;
  else if (handling === "monthly_check") base -= 5;
  if (rep && rep.newNegative7d > 0) base -= 5 * Math.min(3, rep.newNegative7d);

  const score = clamp(Math.round(base), 0, PILLAR_CAPS.reputation);

  const points: string[] = [];
  if (rep) {
    points.push(
      `${rep.totalMentions} public mention${rep.totalMentions === 1 ? "" : "s"} in the past 90 days.`,
    );
    points.push(
      `Sentiment mix: ${Math.round(rep.sentimentMix.positive * 100)}% positive, ${Math.round(rep.sentimentMix.negative * 100)}% negative.`,
    );
    if (rep.newNegative7d > 0) {
      points.push(
        `${rep.newNegative7d} new negative post${rep.newNegative7d === 1 ? "" : "s"} in the last 7 days.`,
      );
    }
  }
  if (handling === "not_at_all") {
    points.push("Quiz: you're not actively monitoring reviews.");
  } else if (handling === "monthly_check") {
    points.push("Quiz: reviews are checked monthly.");
  }

  return {
    score,
    cap: PILLAR_CAPS.reputation,
    headline: pickReputationHeadline(score),
    capReason:
      score >= PILLAR_CAPS.reputation
        ? `Reputation tops out at ${PILLAR_CAPS.reputation} — even the cleanest mention history caps here without real-time alerts and reply velocity tracking.`
        : null,
    points: points.slice(0, 4),
  };
}

function pickReputationHeadline(score: number): string {
  if (score >= 60) return "Well-managed public presence";
  if (score >= 40) return "Mixed-signal public coverage";
  if (score >= 20) return "Reputation exposed";
  return "Unmonitored — high risk";
}

function computeConversion(
  quiz: QuizAnswers | null,
  inputs: ScoringInputs,
): PillarScore {
  const siteFeatures = readMultiAnswer(quiz, "site_features");
  const tour = readSingleAnswer(quiz, "tour_booking");
  const has = (id: string) => siteFeatures.includes(id);

  let base = 75;
  // Each missing conversion-stack element costs real points. The site
  // can technically still convert without these — operators just pay
  // dearly in funnel leakage.
  if (!has("ai_chatbot") && !has("live_chat")) base -= 20;
  if (!has("popups")) base -= 10;
  if (!has("online_application")) base -= 10;
  if (!has("floorplan_tool")) base -= 5;
  if (!has("virtual_tour")) base -= 5;
  if (has("none_of_these")) base -= 10; // explicit "nothing" — extra penalty

  if (tour === "call_only") base -= 15;
  else if (tour === "unclear") base -= 15;
  else if (tour === "form_callback") base -= 5;

  if (
    inputs.lighthousePerformance != null &&
    inputs.lighthousePerformance < 50
  ) {
    base -= 5;
  }

  const score = clamp(Math.round(base), 0, PILLAR_CAPS.conversion);

  const missing: string[] = [];
  if (!has("ai_chatbot") && !has("live_chat")) missing.push("no chatbot");
  if (!has("popups")) missing.push("no popups");
  if (!has("online_application")) missing.push("no online application");
  if (!has("virtual_tour") && !has("floorplan_tool")) {
    missing.push("no interactive tour or floorplan");
  }

  const points: string[] = [];
  if (missing.length > 0) {
    points.push(`Conversion stack gaps: ${missing.join(", ")}.`);
  } else {
    points.push("Most conversion-stack pieces are live.");
  }
  if (tour === "call_only") {
    points.push("Tours are phone-only — blocks the 60%+ who research after 6pm.");
  } else if (tour === "unclear") {
    points.push("No clear tour-booking path — every step costs you the next lease.");
  } else if (tour === "form_callback") {
    points.push("Tours are form + callback — the handoff is where leads ghost.");
  } else if (tour === "self_serve") {
    points.push("Self-serve tour booking is live.");
  }
  if (inputs.lighthousePerformance != null) {
    points.push(`Lighthouse perf: ${inputs.lighthousePerformance}/100.`);
  }

  return {
    score,
    cap: PILLAR_CAPS.conversion,
    headline: pickConversionHeadline(score),
    capReason: `Conversion infrastructure caps at ${PILLAR_CAPS.conversion} — without LeaseStack's chatbot, popups, application flow, and self-serve tour booking integrated, the conversion stack has a structural gap.`,
    points: points.slice(0, 4),
  };
}

function pickConversionHeadline(score: number): string {
  if (score >= 50) return "Mostly conversion-ready";
  if (score >= 30) return "Leaking leads in the funnel";
  if (score >= 15) return "Major conversion gaps";
  return "Conversion infrastructure missing";
}

function computeTracking(quiz: QuizAnswers | null): PillarScore {
  const tracking = readSingleAnswer(quiz, "marketing_tracking");
  const leadSources = readMultiAnswer(quiz, "lead_sources");
  const usesPaid = leadSources.includes("paid_ads");
  const notSure = leadSources.includes("not_sure");

  let base = 60;
  if (tracking === "pixel_plus_analytics") base = 60;
  else if (tracking === "ga_only") base = 35;
  else if (tracking === "crm_only") base = 40;
  else if (tracking === "no_tracking") base = 10;
  else base = 30; // unanswered

  if (notSure) base -= 10;
  if (usesPaid && tracking !== "pixel_plus_analytics") base -= 10;

  const score = clamp(Math.round(base), 0, PILLAR_CAPS.tracking);

  const points: string[] = [];
  if (tracking === "pixel_plus_analytics") {
    points.push("Pixel + analytics is live — you can see who's actually browsing.");
  } else if (tracking === "ga_only") {
    points.push("Google Analytics only — you see counts, not names.");
  } else if (tracking === "crm_only") {
    points.push("CRM tracks post-conversion leads only — the 95% who never convert are invisible.");
  } else if (tracking === "no_tracking") {
    points.push("No marketing tracking today — every ad dollar is going into a black box.");
  }
  if (notSure) {
    points.push("Lead source clarity flagged — you don't know where leads come from.");
  }
  if (usesPaid && tracking !== "pixel_plus_analytics") {
    points.push("Paid ads running without per-lease attribution — most CAC numbers are wrong.");
  }

  return {
    score,
    cap: PILLAR_CAPS.tracking,
    headline: pickTrackingHeadline(score),
    capReason: `Tracking caps at ${PILLAR_CAPS.tracking} — until the visitor pixel + per-lease attribution layer is in place, this ceiling holds regardless of analytics depth.`,
    points: points.slice(0, 4),
  };
}

function pickTrackingHeadline(score: number): string {
  if (score >= 50) return "Tracking baseline in place";
  if (score >= 30) return "Tracking visible, not attributed";
  if (score >= 15) return "Major attribution gaps";
  return "Effectively flying blind";
}

function computeAccessibility(inputs: ScoringInputs): PillarScore {
  // Average accessibility + performance — both Lighthouse-derived. The
  // accessibility category is the floor (a11y failures are non-negotiable),
  // performance is the multiplier.
  const a11y = inputs.lighthouseAccessibility ?? 60;
  const perf = inputs.lighthousePerformance ?? 50;
  const base = Math.round(a11y * 0.6 + perf * 0.4);
  const score = clamp(base, 0, PILLAR_CAPS.accessibility);

  const points: string[] = [];
  if (inputs.lighthouseAccessibility != null) {
    points.push(`Lighthouse accessibility: ${inputs.lighthouseAccessibility}/100.`);
  }
  if (inputs.lighthousePerformance != null) {
    points.push(`Lighthouse performance: ${inputs.lighthousePerformance}/100.`);
  }
  if (
    inputs.lighthouseAccessibility == null &&
    inputs.lighthousePerformance == null
  ) {
    points.push("Lighthouse audit didn't return — site may be blocking crawlers.");
  }

  return {
    score,
    cap: PILLAR_CAPS.accessibility,
    headline: pickAccessibilityHeadline(score),
    capReason:
      score >= PILLAR_CAPS.accessibility
        ? `Accessibility + speed cap at ${PILLAR_CAPS.accessibility} — even green Lighthouse audits leave Core Web Vitals tuning on the table.`
        : null,
    points: points.slice(0, 4),
  };
}

function pickAccessibilityHeadline(score: number): string {
  if (score >= 70) return "Strong technical baseline";
  if (score >= 50) return "Workable, with cleanup needed";
  if (score >= 30) return "Real accessibility risk";
  return "Site fails fundamentals";
}

function computeListings(
  snapshot: SignalSnapshot,
  quiz: QuizAnswers | null,
): PillarScore {
  const leadSources = readMultiAnswer(quiz, "lead_sources");
  const has = (src: string) => leadSources.includes(src);

  let base = 50;
  if (has("apartments_com")) base += 12;
  if (has("zillow")) base += 8;
  if (has("google_search")) base += 8;
  if (has("ai_search")) base += 5;
  if (has("not_sure")) base -= 15;
  // Reputation cross-signal: if Google reviews are showing up, GBP is
  // probably claimed.
  const rep = snapshot.reputation;
  if (
    rep &&
    rep.totalMentions > 0 &&
    rep.sentimentMix.positive + rep.sentimentMix.neutral > 0.5
  ) {
    base += 4;
  }

  const score = clamp(Math.round(base), 0, PILLAR_CAPS.listings);

  const points: string[] = [];
  const claimed = leadSources.filter((s) =>
    ["apartments_com", "zillow", "google_search", "ai_search"].includes(s),
  );
  if (claimed.length > 0) {
    points.push(`Operator claims: ${claimed.length} major source${claimed.length === 1 ? "" : "s"}.`);
  } else {
    points.push("No major listing platforms claimed in the quiz.");
  }
  if (has("not_sure")) {
    points.push("Lead source confusion flagged — quiz answered 'not sure'.");
  }
  if (rep && rep.totalMentions > 0) {
    points.push(`${rep.totalMentions} public mention${rep.totalMentions === 1 ? "" : "s"} across listing-adjacent sources.`);
  }

  return {
    score,
    cap: PILLAR_CAPS.listings,
    headline: pickListingsHeadline(score),
    capReason: `Listing presence caps at ${PILLAR_CAPS.listings} — even full ILS coverage plateaus without a single inventory source-of-truth feeding every platform.`,
    points: points.slice(0, 4),
  };
}

function pickListingsHeadline(score: number): string {
  if (score >= 60) return "Strong listing coverage";
  if (score >= 40) return "Coverage gaps in major ILSes";
  if (score >= 20) return "Missing key listing platforms";
  return "Almost no listing presence";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}
