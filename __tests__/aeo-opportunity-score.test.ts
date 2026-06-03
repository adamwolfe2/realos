import { describe, it, expect } from "vitest";
import {
  computeOpportunityScore,
  OPPORTUNITY_SCORE_WEIGHTS,
  type OpportunityInputs,
} from "@/lib/aeo/opportunity-score";

const ZERO: OpportunityInputs = {
  gscClicks28d: 0,
  gscImpressions28d: 0,
  gscAvgPosition: 0,
  aiSearchVolume: 0,
  yourMentionCount: 0,
  competitorMentionCount: 0,
  onPageSeoScore: null,
};

describe("lib/aeo/opportunity-score — computeOpportunityScore", () => {
  it("returns a low non-zero score for the all-zero baseline (neutral defaults)", () => {
    // onPageHealth defaults to 0.5 (10 weight → 5 pts), mentionGap defaults
    // to 0.5 (25 weight → 12.5 pts) under absent signal. Total ≈ 18.
    const { score, breakdown } = computeOpportunityScore(ZERO);
    expect(breakdown.aiVolumeBand).toBe(0);
    expect(breakdown.mentionGap).toBe(0.5);
    expect(breakdown.onPageHealth).toBe(0.5);
    expect(score).toBeGreaterThan(15);
    expect(score).toBeLessThan(25);
  });

  it("clamps the score to [0, 100]", () => {
    const allMax: OpportunityInputs = {
      gscClicks28d: 100000,
      gscImpressions28d: 1_000_000,
      gscAvgPosition: 1,
      aiSearchVolume: 10_000_000,
      yourMentionCount: 0,
      competitorMentionCount: 1000,
      onPageSeoScore: 100,
    };
    const { score } = computeOpportunityScore(allMax);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThan(80);
  });

  it("ai search volume scales logarithmically — 10x volume increases band by ~0.2", () => {
    const lo = computeOpportunityScore({ ...ZERO, aiSearchVolume: 100 });
    const hi = computeOpportunityScore({ ...ZERO, aiSearchVolume: 1000 });
    expect(hi.breakdown.aiVolumeBand - lo.breakdown.aiVolumeBand).toBeCloseTo(
      0.2,
      1,
    );
  });

  it("position #1 is worth ~5x position #10 in gscPotential", () => {
    const top = computeOpportunityScore({
      ...ZERO,
      gscImpressions28d: 5000,
      gscAvgPosition: 1,
    });
    const ten = computeOpportunityScore({
      ...ZERO,
      gscImpressions28d: 5000,
      gscAvgPosition: 10,
    });
    expect(top.breakdown.gscPotential / ten.breakdown.gscPotential).toBeCloseTo(
      2.5,
      0.5,
    );
  });

  it("mention gap is 1.0 when only competitors mentioned (full opportunity)", () => {
    const r = computeOpportunityScore({
      ...ZERO,
      yourMentionCount: 0,
      competitorMentionCount: 4,
    });
    expect(r.breakdown.mentionGap).toBe(1);
  });

  it("mention gap is 0.0 when you dominate (no opportunity)", () => {
    const r = computeOpportunityScore({
      ...ZERO,
      yourMentionCount: 10,
      competitorMentionCount: 0,
    });
    expect(r.breakdown.mentionGap).toBe(0);
  });

  it("competitor presence saturates around 5 competitors", () => {
    const five = computeOpportunityScore({
      ...ZERO,
      competitorMentionCount: 5,
    });
    const twenty = computeOpportunityScore({
      ...ZERO,
      competitorMentionCount: 20,
    });
    // 5 → 1 - e^-1 ≈ 0.632
    expect(five.breakdown.competitorPresence).toBeCloseTo(0.632, 2);
    expect(twenty.breakdown.competitorPresence).toBeLessThan(1);
    expect(
      twenty.breakdown.competitorPresence - five.breakdown.competitorPresence,
    ).toBeLessThan(0.4);
  });

  it("onPageHealth uses 0.5 when null", () => {
    const a = computeOpportunityScore({ ...ZERO, onPageSeoScore: null });
    const b = computeOpportunityScore({ ...ZERO, onPageSeoScore: 50 });
    expect(a.breakdown.onPageHealth).toBe(b.breakdown.onPageHealth);
    expect(a.breakdown.onPageHealth).toBe(0.5);
  });

  it("score is deterministic — identical inputs always produce identical score", () => {
    const inputs: OpportunityInputs = {
      gscClicks28d: 42,
      gscImpressions28d: 1234,
      gscAvgPosition: 7.3,
      aiSearchVolume: 500,
      yourMentionCount: 1,
      competitorMentionCount: 3,
      onPageSeoScore: 72,
    };
    const a = computeOpportunityScore(inputs);
    const b = computeOpportunityScore(inputs);
    expect(a.score).toBe(b.score);
    expect(a.breakdown).toEqual(b.breakdown);
  });

  it("weights sum to 100", () => {
    const sum =
      OPPORTUNITY_SCORE_WEIGHTS.aiVolumeBand +
      OPPORTUNITY_SCORE_WEIGHTS.mentionGap +
      OPPORTUNITY_SCORE_WEIGHTS.gscPotential +
      OPPORTUNITY_SCORE_WEIGHTS.competitorPresence +
      OPPORTUNITY_SCORE_WEIGHTS.onPageHealth;
    expect(sum).toBe(100);
  });

  it("a realistic upside keyword (AI volume + mention gap + 1 cited URL) scores 50-80", () => {
    const inputs: OpportunityInputs = {
      gscClicks28d: 12,
      gscImpressions28d: 800,
      gscAvgPosition: 8,
      aiSearchVolume: 1500,
      yourMentionCount: 1,
      competitorMentionCount: 5,
      onPageSeoScore: 70,
    };
    const { score } = computeOpportunityScore(inputs);
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThanOrEqual(80);
  });
});
