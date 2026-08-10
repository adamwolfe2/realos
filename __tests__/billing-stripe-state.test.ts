import { describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@prisma/client";
import {
  invoiceActivatesTrial,
  isPlatformSubscriptionForOrg,
  isProposalSubscription,
  isTrialActivationSubscriptionForOrg,
  selectPlatformSubscriptionForOrg,
  subscriptionStatusUpdate,
} from "@/lib/billing/stripe-state";
import {
  isWorkspaceReadOnly,
  resolveTrialState,
} from "@/lib/billing/trial-status";

describe("Stripe billing state transitions", () => {
  it("keeps proposal subscriptions outside platform billing state", () => {
    const proposal = {
      kind: "proposal",
      proposalId: "proposal_1",
      intent: "trial_activation",
      org_id: "org_1",
    };
    expect(isProposalSubscription(proposal)).toBe(true);
    expect(isPlatformSubscriptionForOrg(proposal, "org_1")).toBe(false);
    expect(isTrialActivationSubscriptionForOrg(proposal, "org_1")).toBe(
      false,
    );
  });

  it("requires matching platform metadata for trial activation", () => {
    const platform = { intent: "trial_activation", org_id: "org_1" };
    expect(isPlatformSubscriptionForOrg(platform, "org_1")).toBe(true);
    expect(isTrialActivationSubscriptionForOrg(platform, "org_1")).toBe(
      true,
    );
    expect(isPlatformSubscriptionForOrg(platform, "org_2")).toBe(false);
    expect(isTrialActivationSubscriptionForOrg(platform, "org_2")).toBe(
      false,
    );
  });

  it("recognizes explicitly tagged legacy platform subscriptions", () => {
    expect(
      isPlatformSubscriptionForOrg(
        { intent: "upgrade_or_add", org_id: "org_1" },
        "org_1",
      ),
    ).toBe(true);
    expect(isPlatformSubscriptionForOrg({}, "org_1")).toBe(false);
  });

  it("finds an older platform subscription behind many newer proposals", () => {
    const proposals = Array.from({ length: 7 }, (_, index) => ({
      id: `sub_proposal_${index}`,
      status: "active",
      metadata: { kind: "proposal", proposalId: `proposal_${index}` },
    }));
    const platform = {
      id: "sub_platform",
      status: "active",
      metadata: { intent: "trial_activation", org_id: "org_1" },
    };
    expect(
      selectPlatformSubscriptionForOrg(
        [...proposals, platform],
        "org_1",
        new Set(["active", "trialing"]),
      ),
    ).toEqual(platform);
  });

  it("does not let subscription events activate or grant grace to a trial", () => {
    for (const status of ["active", "incomplete", "past_due", "unpaid"] as const) {
      expect(
        subscriptionStatusUpdate(SubscriptionStatus.TRIALING, status),
      ).toBeNull();
    }
  });

  it("keeps a Stripe trial represented as the existing in-app trial", () => {
    expect(
      subscriptionStatusUpdate(SubscriptionStatus.TRIALING, "trialing"),
    ).toBe(SubscriptionStatus.TRIALING);
  });

  it("does not let a subscription event activate a null-status legacy workspace", () => {
    expect(subscriptionStatusUpdate(null, "active")).toBeNull();
    expect(subscriptionStatusUpdate(null, "past_due")).toBeNull();
    expect(subscriptionStatusUpdate(null, "trialing")).toBe(
      SubscriptionStatus.TRIALING,
    );
  });

  it("does not let a stale incomplete event regress an active customer", () => {
    expect(
      subscriptionStatusUpdate(SubscriptionStatus.ACTIVE, "incomplete"),
    ).toBeNull();
  });

  it("preserves grace for a previously active customer with a failed renewal", () => {
    expect(
      subscriptionStatusUpdate(SubscriptionStatus.ACTIVE, "past_due"),
    ).toBe(SubscriptionStatus.PAST_DUE);
  });

  it("does not unlock an internally paused customer on another retry event", () => {
    expect(
      subscriptionStatusUpdate(SubscriptionStatus.PAUSED, "past_due"),
    ).toBeNull();
  });

  it("activates an immediate first invoice only when money cleared", () => {
    expect(
      invoiceActivatesTrial({
        status: "paid",
        billingReason: "subscription_create",
        amountPaid: 138_500,
      }),
    ).toBe(true);
    expect(
      invoiceActivatesTrial({
        status: "paid",
        billingReason: "subscription_create",
        amountPaid: 0,
      }),
    ).toBe(false);
  });

  it("activates the invoice issued when a scheduled trial reaches its end", () => {
    expect(
      invoiceActivatesTrial({
        status: "paid",
        billingReason: "subscription_cycle",
        amountPaid: 138_500,
      }),
    ).toBe(true);
  });

  it("treats canceled subscriptions as read-only", () => {
    const canceled = {
      subscriptionStatus: SubscriptionStatus.CANCELED,
      trialStartedAt: new Date("2026-07-01T00:00:00.000Z"),
      trialEndsAt: new Date("2026-07-15T00:00:00.000Z"),
    };
    expect(resolveTrialState(canceled)).toBe("canceled");
    expect(isWorkspaceReadOnly(canceled)).toBe(true);
  });
});
