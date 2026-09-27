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

import { packageLabelFor } from "@/lib/billing/features";

describe("packageLabelFor", () => {
  it("says the org's plan includes a module at or below its tier", () => {
    expect(packageLabelFor("moduleChatbot", "GROWTH")).toBe("Included in Growth");
    expect(packageLabelFor("modulePixel", "GROWTH")).toBe("Included in Growth");
  });

  it("names the lowest plan that unlocks a higher-tier module", () => {
    expect(packageLabelFor("moduleReferrals", "GROWTH")).toBe("Scale plan");
    expect(packageLabelFor("modulePixel", "STARTER")).toBe("Growth plan");
  });

  it("returns null for keys outside the package catalog or with no plan", () => {
    expect(packageLabelFor("whiteLabel", "SCALE")).toBeNull();
    expect(packageLabelFor("moduleChatbot", null)).toBeNull();
  });
});
