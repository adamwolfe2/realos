import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  billingCheckoutIdempotencyKey,
  canManageBilling,
  canonicalFeatureKeys,
  stripeTrialSchedule,
} from "@/lib/billing/checkout-policy";

describe("billing checkout policy", () => {
  it("allows only the client owner on a client session", () => {
    expect(
      canManageBilling({
        role: UserRole.CLIENT_OWNER,
        isAgency: false,
        isImpersonating: false,
      }),
    ).toBe(true);
    expect(
      canManageBilling({
        role: UserRole.CLIENT_ADMIN,
        isAgency: false,
        isImpersonating: false,
      }),
    ).toBe(false);
  });

  it("allows LeaseStack agency staff only while supporting a client", () => {
    expect(
      canManageBilling({
        role: UserRole.AGENCY_OPERATOR,
        isAgency: true,
        isImpersonating: true,
      }),
    ).toBe(true);
    expect(
      canManageBilling({
        role: UserRole.AGENCY_OPERATOR,
        isAgency: true,
        isImpersonating: false,
      }),
    ).toBe(false);
    expect(
      canManageBilling({
        role: UserRole.AL_PARTNER,
        isAgency: true,
        isImpersonating: true,
      }),
    ).toBe(false);
  });

  it("canonicalizes valid feature keys for pricing and idempotency", () => {
    expect(
      canonicalFeatureKeys([
        "moduleSEO",
        "moduleChatbot",
        "moduleSEO",
        "not-a-feature",
      ]),
    ).toEqual(["moduleChatbot", "moduleSEO"]);
  });

  it("uses the exact trial end when Stripe's 48-hour minimum is satisfied", () => {
    const now = new Date("2026-08-04T12:00:00.000Z");
    const end = new Date("2026-08-08T12:00:00.000Z");
    expect(stripeTrialSchedule(end, now)).toEqual({
      trial_end: Math.floor(end.getTime() / 1000),
    });
  });

  it("gives a customer-safe whole-day bridge when less than 48 hours remain", () => {
    const now = new Date("2026-08-04T12:00:00.000Z");
    const end = new Date("2026-08-05T18:00:00.000Z");
    expect(stripeTrialSchedule(end, now)).toEqual({ trial_period_days: 2 });
  });

  it("charges immediately after the in-app trial expires", () => {
    const now = new Date("2026-08-04T12:00:00.000Z");
    expect(
      stripeTrialSchedule(new Date("2026-08-04T11:59:59.000Z"), now),
    ).toEqual({});
  });

  it("makes different carts produce different idempotency keys", () => {
    const base = {
      orgId: "org_1",
      tierId: "scale",
      cycle: "monthly",
      propertyCount: 1,
      priceIds: ["price_base", "price_chatbot"],
      trialEndsAt: new Date("2026-08-08T12:00:00.000Z"),
    } as const;
    const a = billingCheckoutIdempotencyKey({
      ...base,
      featureKeys: ["moduleChatbot"],
    });
    const b = billingCheckoutIdempotencyKey({
      ...base,
      featureKeys: ["moduleChatbot", "moduleSEO"],
    });
    expect(a).not.toBe(b);
  });

  it("makes reordered duplicate feature keys produce the same key", () => {
    const base = {
      orgId: "org_1",
      tierId: "scale",
      cycle: "monthly",
      propertyCount: 1,
      priceIds: ["price_base", "price_chatbot"],
      trialEndsAt: new Date("2026-08-08T12:00:00.000Z"),
    } as const;
    const a = billingCheckoutIdempotencyKey({
      ...base,
      featureKeys: ["moduleSEO", "moduleChatbot", "moduleSEO"],
    });
    const b = billingCheckoutIdempotencyKey({
      ...base,
      featureKeys: ["moduleChatbot", "moduleSEO"],
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^co_org_1_[a-f0-9]{24}$/);
  });

  it("invalidates checkout idempotency when a Stripe price changes", () => {
    const base = {
      orgId: "org_1",
      tierId: "scale",
      cycle: "monthly",
      propertyCount: 1,
      featureKeys: ["moduleChatbot"],
      trialEndsAt: new Date("2026-08-08T12:00:00.000Z"),
    } as const;
    expect(
      billingCheckoutIdempotencyKey({
        ...base,
        priceIds: ["price_base_v1", "price_chat_v1"],
      }),
    ).not.toBe(
      billingCheckoutIdempotencyKey({
        ...base,
        priceIds: ["price_base_v1", "price_chat_v2"],
      }),
    );
  });
});
