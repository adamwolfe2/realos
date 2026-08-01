import { describe, it, expect } from "vitest";
import {
  retentionTierFromSubscription,
  getAdRetentionPolicy,
  describeAdRetentionPolicy,
} from "@/lib/billing/retention";

// ---------------------------------------------------------------------------
// Coverage gap: lib/billing/retention.ts determines how much ad-metrics
// history survives the nightly retention cron (lib/billing/ad-retention-job.ts
// deletes AdMetricDaily rows outside the resolved window). Zero prior
// coverage on the pure policy logic — a regression here either purges a
// paying customer's data early or never rolls up/purges at all. The
// override-clamp (1..120 months) is the one thing standing between an
// operator typo and either "wipe everything" or "retention never fires."
// ---------------------------------------------------------------------------

describe("retentionTierFromSubscription", () => {
  it("maps each known Prisma tier to its retention tier", () => {
    expect(retentionTierFromSubscription("STARTER")).toBe("foundation");
    expect(retentionTierFromSubscription("GROWTH")).toBe("growth");
    expect(retentionTierFromSubscription("SCALE")).toBe("scale");
    expect(retentionTierFromSubscription("CUSTOM")).toBe("enterprise");
  });

  it("defaults null/undefined/unknown to the most restrictive tier (foundation)", () => {
    expect(retentionTierFromSubscription(null)).toBe("foundation");
    expect(retentionTierFromSubscription(undefined)).toBe("foundation");
    expect(retentionTierFromSubscription("SOME_FUTURE_TIER")).toBe("foundation");
  });
});

describe("getAdRetentionPolicy", () => {
  it("Foundation: 1 month daily, no monthly rollup, override ignored even if set", () => {
    const policy = getAdRetentionPolicy({
      subscriptionTier: "STARTER",
      adDataRetentionMonths: 60,
    });
    expect(policy).toEqual({
      tier: "foundation",
      dailyWindowMonths: 1,
      monthlyEnabled: false,
      customOverride: null,
    });
  });

  it("Growth: 12 months daily + rollup enabled, override ignored", () => {
    const policy = getAdRetentionPolicy({
      subscriptionTier: "GROWTH",
      adDataRetentionMonths: 99,
    });
    expect(policy.dailyWindowMonths).toBe(12);
    expect(policy.monthlyEnabled).toBe(true);
    expect(policy.customOverride).toBeNull();
  });

  it("Scale: honors a valid operator override", () => {
    const policy = getAdRetentionPolicy({
      subscriptionTier: "SCALE",
      adDataRetentionMonths: 36,
    });
    expect(policy.dailyWindowMonths).toBe(36);
    expect(policy.customOverride).toBe(36);
  });

  it("Scale with no override falls back to the 24-month default", () => {
    const policy = getAdRetentionPolicy({ subscriptionTier: "SCALE" });
    expect(policy.dailyWindowMonths).toBe(24);
    expect(policy.customOverride).toBeNull();
  });

  it("clamps an operator override below the floor (would wipe history) up to 1", () => {
    const policy = getAdRetentionPolicy({
      subscriptionTier: "SCALE",
      adDataRetentionMonths: -5,
    });
    expect(policy.dailyWindowMonths).toBe(1);
    expect(policy.customOverride).toBe(1);
  });

  it("clamps an operator override above the ceiling (would never roll up) down to 120", () => {
    const policy = getAdRetentionPolicy({
      subscriptionTier: "ENTERPRISE_TIER_DOES_NOT_EXIST" as never,
      adDataRetentionMonths: 9999,
    });
    // Unknown tier string -> falls back to foundation, override still inert there.
    expect(policy.tier).toBe("foundation");
    expect(policy.customOverride).toBeNull();
  });

  it("clamps a Scale override above the ceiling down to 120", () => {
    const policy = getAdRetentionPolicy({
      subscriptionTier: "SCALE",
      adDataRetentionMonths: 9999,
    });
    expect(policy.dailyWindowMonths).toBe(120);
    expect(policy.customOverride).toBe(120);
  });

  it("ignores a non-finite override (NaN/Infinity) and falls back to the tier default", () => {
    const policy = getAdRetentionPolicy({
      subscriptionTier: "SCALE",
      adDataRetentionMonths: NaN,
    });
    expect(policy.dailyWindowMonths).toBe(24);
    expect(policy.customOverride).toBeNull();
  });

  it("falls back through `tier` before `subscriptionTier` when both are present", () => {
    const policy = getAdRetentionPolicy({
      tier: "GROWTH",
      subscriptionTier: "STARTER",
    });
    expect(policy.tier).toBe("growth");
  });
});

describe("describeAdRetentionPolicy", () => {
  it("describes the Foundation policy as purge (no rollup)", () => {
    const text = describeAdRetentionPolicy(getAdRetentionPolicy({ subscriptionTier: "STARTER" }));
    expect(text).toContain("last 28 days");
    expect(text).toContain("purged");
  });

  it("describes a rollup-enabled policy as kept indefinitely", () => {
    const text = describeAdRetentionPolicy(getAdRetentionPolicy({ subscriptionTier: "GROWTH" }));
    expect(text).toContain("last 12 months");
    expect(text).toContain("kept indefinitely");
  });
});
