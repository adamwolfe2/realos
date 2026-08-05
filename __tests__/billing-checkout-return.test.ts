import { describe, expect, it } from "vitest";
import {
  resolveCheckoutReturn,
  resolveScheduledTrialEnd,
} from "@/lib/billing/checkout-return";

const base = {
  expectedOrgId: "org_1",
  expectedCustomerId: "cus_1",
  sessionOrgId: "org_1",
  sessionCustomerId: "cus_1",
  sessionMode: "subscription",
  sessionStatus: "complete",
  paymentStatus: "paid",
  stripeSubscriptionStatus: "active",
  subscriptionStatus: "TRIALING",
} as const;

describe("Checkout return verification", () => {
  it("rejects a session owned by another organization or customer", () => {
    expect(
      resolveCheckoutReturn({ ...base, sessionOrgId: "org_other" }),
    ).toBe("invalid");
    expect(
      resolveCheckoutReturn({ ...base, sessionCustomerId: "cus_other" }),
    ).toBe("invalid");
  });

  it("never claims success for an open or unpaid session", () => {
    expect(resolveCheckoutReturn({ ...base, sessionStatus: "open" })).toBe(
      "invalid",
    );
    expect(resolveCheckoutReturn({ ...base, paymentStatus: "unpaid" })).toBe(
      "invalid",
    );
  });

  it("shows scheduled when Checkout collected a method for a continuing trial", () => {
    expect(
      resolveCheckoutReturn({
        ...base,
        paymentStatus: "no_payment_required",
      }),
    ).toBe("scheduled");
  });

  it("does not claim payment when Stripe marks a free-trial Checkout paid", () => {
    expect(
      resolveCheckoutReturn({
        ...base,
        paymentStatus: "paid",
        stripeSubscriptionStatus: "trialing",
      }),
    ).toBe("scheduled");
  });

  it("rejects a trialing subscription when Checkout is unpaid", () => {
    expect(
      resolveCheckoutReturn({
        ...base,
        paymentStatus: "unpaid",
        stripeSubscriptionStatus: "trialing",
      }),
    ).toBe("invalid");
  });

  it("shows processing when Stripe paid but the webhook has not activated yet", () => {
    expect(resolveCheckoutReturn(base)).toBe("processing");
  });

  it("shows active only when Stripe and LeaseStack agree", () => {
    expect(
      resolveCheckoutReturn({ ...base, subscriptionStatus: "ACTIVE" }),
    ).toBe("active");
  });

  it("uses Stripe's authoritative trial end before the database catches up", () => {
    const orgTrialEnd = new Date("2026-08-08T12:00:00.000Z");
    const stripeTrialEnd = Date.parse("2026-08-09T12:00:00.000Z") / 1000;
    expect(resolveScheduledTrialEnd(stripeTrialEnd, orgTrialEnd)).toEqual(
      new Date("2026-08-09T12:00:00.000Z"),
    );
    expect(resolveScheduledTrialEnd(null, orgTrialEnd)).toEqual(orgTrialEnd);
  });
});
