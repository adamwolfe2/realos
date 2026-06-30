import { describe, it, expect } from "vitest";
import {
  resolveTrialState,
  isWorkspaceReadOnly,
  type TrialStatusInput,
} from "@/lib/billing/trial-status";

// Regression coverage for the "paused account" dunning slice (P2):
// the 14-day-overdue escalation sets subscriptionStatus=PAUSED, the portal
// must flip read-only so the "your account has been paused" email is true,
// and impersonating support must still be able to fix things.

const base: TrialStatusInput = {
  subscriptionStatus: null,
  trialStartedAt: null,
  trialEndsAt: null,
};

const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

describe("resolveTrialState — PAUSED", () => {
  it("maps PAUSED to the dedicated 'paused' state", () => {
    expect(resolveTrialState({ ...base, subscriptionStatus: "PAUSED" })).toBe(
      "paused",
    );
  });

  it("still maps ACTIVE/PAST_DUE to paid and TRIALING correctly", () => {
    expect(resolveTrialState({ ...base, subscriptionStatus: "ACTIVE" })).toBe(
      "paid",
    );
    expect(resolveTrialState({ ...base, subscriptionStatus: "PAST_DUE" })).toBe(
      "paid",
    );
    expect(
      resolveTrialState({
        ...base,
        subscriptionStatus: "TRIALING",
        trialEndsAt: future,
      }),
    ).toBe("trial_active");
    expect(
      resolveTrialState({
        ...base,
        subscriptionStatus: "TRIALING",
        trialEndsAt: past,
      }),
    ).toBe("trial_expired");
  });
});

describe("isWorkspaceReadOnly — PAUSED enforcement", () => {
  it("is read-only when the workspace is PAUSED", () => {
    expect(
      isWorkspaceReadOnly({ ...base, subscriptionStatus: "PAUSED" }),
    ).toBe(true);
  });

  it("is read-only when an unactivated trial has expired", () => {
    expect(
      isWorkspaceReadOnly({
        ...base,
        subscriptionStatus: "TRIALING",
        trialEndsAt: past,
      }),
    ).toBe(true);
  });

  it("is writable for paid (ACTIVE / PAST_DUE grace) workspaces", () => {
    expect(
      isWorkspaceReadOnly({ ...base, subscriptionStatus: "ACTIVE" }),
    ).toBe(false);
    expect(
      isWorkspaceReadOnly({ ...base, subscriptionStatus: "PAST_DUE" }),
    ).toBe(false);
  });

  it("lets impersonating support bypass the PAUSED lock to fix billing", () => {
    expect(
      isWorkspaceReadOnly(
        { ...base, subscriptionStatus: "PAUSED" },
        { isImpersonating: true },
      ),
    ).toBe(false);
  });
});
