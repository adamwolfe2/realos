import { describe, expect, it } from "vitest";
import { featureKeysForTier, inferTierFromSelection } from "@/lib/billing/features";

describe("featureKeysForTier", () => {
  it("nests packages: Foundation within Growth within Scale", () => {
    const starter = featureKeysForTier("STARTER");
    const growth = featureKeysForTier("GROWTH");
    const scale = featureKeysForTier("SCALE");
    expect(starter).toContain("moduleChatbot");
    expect(starter).not.toContain("modulePixel");
    expect(growth).toEqual(expect.arrayContaining(starter));
    expect(growth).toContain("modulePixel");
    expect(growth).not.toContain("moduleReferrals");
    expect(scale).toEqual(expect.arrayContaining(growth));
    expect(scale).toContain("moduleReferrals");
  });

  it("round-trips: a package's features infer back to that package", () => {
    for (const tier of ["STARTER", "GROWTH", "SCALE"] as const) {
      expect(inferTierFromSelection(featureKeysForTier(tier))).toBe(tier);
    }
  });
});
