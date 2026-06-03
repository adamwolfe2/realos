/**
 * AEO Opportunity Score formula.
 *
 * Pure compute. No DB, no IO. Given the five inputs we precomputed for a
 * keyword, return a 0-100 composite score + a per-component breakdown
 * the UI can render as a stacked bar.
 *
 * Weighting model (W2 gut weights, tunable in W3 once we have ≥5
 * tenants of signal to back-test against):
 *
 *   aiVolumeBand        × 30  — log-scaled AI search volume; reward
 *                                 keywords that AI engines see asked
 *                                 a lot of, regardless of Google volume.
 *   mentionGap          × 25  — (1 - yourShareOfVoice); the bigger the
 *                                 gap, the more upside if we close it.
 *   gscPotential        × 20  — impressions × position decay; rewards
 *                                 queries we're already showing up for
 *                                 in Google, because AI Overviews +
 *                                 LLM training tend to cite ranked
 *                                 pages.
 *   competitorPresence  × 15  — 1 - exp(-competitorCount/5); saturates
 *                                 around 5 competitors named — past
 *                                 that point the urgency is "ship
 *                                 something" not "ship more".
 *   onPageHealth        × 10  — clamps the upside: a 30/100 OnPage
 *                                 score means AEO fixes won't compound
 *                                 because the page itself is broken.
 *
 * The 30/25/20/15/10 ratios are explicit so future formula tweaks can
 * justify their deltas against this baseline.
 */

import "server-only";

export interface OpportunityInputs {
  /// 28-day Google Search Console clicks for this keyword.
  gscClicks28d: number;
  /// 28-day GSC impressions.
  gscImpressions28d: number;
  /// Average GSC position (1.0 = top). 0 when unknown.
  gscAvgPosition: number;
  /// DataForSEO ai_keyword_data monthly AI search volume estimate.
  /// 0 when DataForSEO returned no data (still a valid input; we just
  /// score AI volume = 0 for that keyword).
  aiSearchVolume: number;
  /// Number of AeoMentionSnapshot entries where the brand was mentioned
  /// for this keyword in the last 30 days.
  yourMentionCount: number;
  /// Same window, but classified-as-competitor mentions.
  competitorMentionCount: number;
  /// Org-level latest OnPage SEO Lighthouse score, 0-100. Null when
  /// no OnPage audit has run yet; we treat null as 50 (neutral).
  onPageSeoScore: number | null;
}

export interface OpportunityBreakdown {
  aiVolumeBand: number;
  mentionGap: number;
  gscPotential: number;
  competitorPresence: number;
  onPageHealth: number;
}

export interface OpportunityResult {
  /// 0-100 composite. Rounded to integer for stable UI.
  score: number;
  /// 0-1 per-component values, in the same units the weighting formula
  /// expects. Multiply each by its weight to reproduce `score`.
  breakdown: OpportunityBreakdown;
}

const WEIGHTS = {
  aiVolumeBand: 30,
  mentionGap: 25,
  gscPotential: 20,
  competitorPresence: 15,
  onPageHealth: 10,
} as const;

/// Bands for log-scaled AI search volume. Tuned for the real-estate
/// long-tail: most keywords are 0-1k AI volume; the rare 10k+ keyword
/// is the headline opportunity.
function bandAiVolume(volume: number): number {
  if (!Number.isFinite(volume) || volume <= 0) return 0;
  // Math.log10(1) = 0, log10(10) = 1, log10(100) = 2, etc. Saturate at
  // log10(100_000) = 5 → 1.0.
  return Math.min(Math.log10(volume + 1) / 5, 1);
}

/// Position decay — being #1 is worth ~5× being #10 in terms of "Google
/// thinks this page is the answer", which AI overviews and LLM training
/// data inherit.
function positionDecay(position: number): number {
  if (!Number.isFinite(position) || position <= 0) return 0;
  if (position <= 1) return 1;
  if (position <= 3) return 0.8;
  if (position <= 5) return 0.6;
  if (position <= 10) return 0.4;
  return 0.2;
}

function gscPotential(impressions: number, position: number): number {
  if (!Number.isFinite(impressions) || impressions <= 0) return 0;
  // Soft-cap impressions at 5000/month-equivalent (≈180/day). That's an
  // arbitrary saturation point; past it, additional impressions don't
  // meaningfully change "this is a keyword we already rank for".
  const impressionBand = Math.min(impressions / 5000, 1);
  return impressionBand * positionDecay(position);
}

function mentionGap(yourCount: number, competitorCount: number): number {
  const total = yourCount + competitorCount;
  if (total === 0) {
    // No mention signal yet — neutral 0.5 so absent-data keywords don't
    // dominate the top of the list purely because of empty inputs.
    return 0.5;
  }
  return 1 - yourCount / total;
}

function competitorPresence(competitorCount: number): number {
  if (!Number.isFinite(competitorCount) || competitorCount <= 0) return 0;
  return 1 - Math.exp(-competitorCount / 5);
}

function onPageHealth(onPageSeoScore: number | null): number {
  if (onPageSeoScore == null || !Number.isFinite(onPageSeoScore)) return 0.5;
  return Math.max(0, Math.min(onPageSeoScore / 100, 1));
}

/**
 * Compute the 0-100 opportunity score + per-component breakdown.
 *
 * Determinism: same inputs → same score, bit-stable across runs. No
 * randomness, no time-dependent inputs.
 */
export function computeOpportunityScore(
  inputs: OpportunityInputs,
): OpportunityResult {
  const breakdown: OpportunityBreakdown = {
    aiVolumeBand: bandAiVolume(inputs.aiSearchVolume),
    mentionGap: mentionGap(inputs.yourMentionCount, inputs.competitorMentionCount),
    gscPotential: gscPotential(
      inputs.gscImpressions28d,
      inputs.gscAvgPosition,
    ),
    competitorPresence: competitorPresence(inputs.competitorMentionCount),
    onPageHealth: onPageHealth(inputs.onPageSeoScore),
  };
  const weighted =
    breakdown.aiVolumeBand * WEIGHTS.aiVolumeBand +
    breakdown.mentionGap * WEIGHTS.mentionGap +
    breakdown.gscPotential * WEIGHTS.gscPotential +
    breakdown.competitorPresence * WEIGHTS.competitorPresence +
    breakdown.onPageHealth * WEIGHTS.onPageHealth;
  const score = Math.round(Math.max(0, Math.min(weighted, 100)));
  return { score, breakdown };
}

export const OPPORTUNITY_SCORE_WEIGHTS = WEIGHTS;
