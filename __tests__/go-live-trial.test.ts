import { describe, it, expect } from "vitest";
import {
  computeGoLiveTrialEnd,
  hasCardOnFile,
} from "@/lib/billing/trial-status";
import { computeTrialEndsAt } from "@/lib/onboarding/steps";

// Go-live trial (plans/go-live-trial slice 1). Invariant: the trial is never
// shortened, never exceeds signup + 30 days, and never moves once Stripe owns
// the trial_end (card on file).

const DAY = 24 * 60 * 60 * 1000;
const signup = new Date("2026-09-01T12:00:00Z");
const at = (days: number) => new Date(signup.getTime() + days * DAY);

describe("computeTrialEndsAt (new trials)", () => {
  it("starts with the 30-day setup window, not a 14-day clock", () => {
    expect(computeTrialEndsAt(signup)).toEqual(at(30));
  });
});

describe("computeGoLiveTrialEnd", () => {
  const newTrial = { trialStartedAt: signup, trialEndsAt: at(30) };

  it("gives 14 days from go-live when that fits under the cap", () => {
    expect(
      computeGoLiveTrialEnd({ ...newTrial, goLiveAt: at(3), cardOnFile: false }),
    ).toEqual(at(17));
  });

  it("caps at signup + 30 days for a late go-live", () => {
    // Late go-live: formula == placeholder, nothing to write.
    expect(
      computeGoLiveTrialEnd({ ...newTrial, goLiveAt: at(20), cardOnFile: false }),
    ).toBeNull();
  });

  it("never shortens a legacy 14-day trial", () => {
    const legacy = { trialStartedAt: signup, trialEndsAt: at(14) };
    // go-live on day 2 -> formula day 16, later than day 14: extend.
    expect(
      computeGoLiveTrialEnd({ ...legacy, goLiveAt: at(2), cardOnFile: false }),
    ).toEqual(at(16));
    // go-live at signup -> formula day 14 == existing: no change.
    expect(
      computeGoLiveTrialEnd({ ...legacy, goLiveAt: signup, cardOnFile: false }),
    ).toBeNull();
  });

  it("keeps a non-placeholder end that is later than the formula", () => {
    const extended = { trialStartedAt: signup, trialEndsAt: at(25) };
    expect(
      computeGoLiveTrialEnd({ ...extended, goLiveAt: at(1), cardOnFile: false }),
    ).toBeNull();
  });

  it("never moves the end once a card is on file (Stripe owns trial_end)", () => {
    expect(
      computeGoLiveTrialEnd({ ...newTrial, goLiveAt: at(3), cardOnFile: true }),
    ).toBeNull();
  });

  it("never revives an expired trial", () => {
    const expired = { trialStartedAt: signup, trialEndsAt: at(14) };
    expect(
      computeGoLiveTrialEnd({ ...expired, goLiveAt: at(15), cardOnFile: false }),
    ).toBeNull();
  });

  it("leaves trials with no start date alone", () => {
    expect(
      computeGoLiveTrialEnd({
        trialStartedAt: null,
        trialEndsAt: at(14),
        goLiveAt: at(1),
        cardOnFile: false,
      }),
    ).toBeNull();
  });
});

describe("hasCardOnFile", () => {
  const base = {
    subscriptionStatus: "TRIALING" as const,
    currentPeriodEnd: at(17),
    cancelAtPeriodEnd: false,
  };
  it("is true for a trialing org with a scheduled Stripe subscription", () => {
    expect(hasCardOnFile(base)).toBe(true);
  });
  it("is false with no Stripe subscription period", () => {
    expect(hasCardOnFile({ ...base, currentPeriodEnd: null })).toBe(false);
  });
  it("is false when the subscription is set to cancel at trial end", () => {
    expect(hasCardOnFile({ ...base, cancelAtPeriodEnd: true })).toBe(false);
  });
  it("is false outside the trial", () => {
    expect(hasCardOnFile({ ...base, subscriptionStatus: "ACTIVE" })).toBe(false);
  });
});
