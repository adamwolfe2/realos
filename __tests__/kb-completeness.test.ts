import { describe, it, expect } from "vitest";
import {
  computeKbCompleteness,
  isUsableFloorPlan,
  parseFloorPlans,
  type KnowledgeBaseShape,
} from "@/lib/properties/kb-completeness";

// ---------------------------------------------------------------------------
// Completeness scoring for the structured property knowledge base (slice S1).
// Warn-only: these drive a checklist banner, never a publish gate. The
// critical items are exactly the facts the bot most often invents when
// missing (floor plans, amenities, pet/parking/lease/application).
// ---------------------------------------------------------------------------

const ALL_CRITICAL: KnowledgeBaseShape = {
  floorPlans: [{ type: "Double", squareFeet: 420, bedrooms: 2, bathrooms: 1 }],
  communityAmenities: ["Gym"],
  petPolicy: "Cats OK",
  parkingInfo: "Street parking",
  leaseTerms: "12 month",
  applicationProcess: "Apply online",
};

describe("computeKbCompleteness", () => {
  it("scores an empty/null KB at 0 with every critical item missing", () => {
    const empty = computeKbCompleteness(null);
    expect(empty.score).toBe(0);
    expect(empty.missingCritical.length).toBeGreaterThan(0);
    expect(empty.items.every((i) => !i.done)).toBe(true);
    // Every critical check should appear in missingCritical when nothing is set.
    const criticalCount = empty.items.filter((i) => i.critical).length;
    expect(empty.missingCritical.length).toBe(criticalCount);
  });

  it("clears missingCritical once all critical facts are present", () => {
    const res = computeKbCompleteness(ALL_CRITICAL);
    expect(res.missingCritical).toEqual([]);
    expect(res.score).toBeGreaterThan(0);
  });

  it("scores 100 only when optional items are filled too", () => {
    const partial = computeKbCompleteness(ALL_CRITICAL);
    expect(partial.score).toBeLessThan(100);

    const full = computeKbCompleteness({
      ...ALL_CRITICAL,
      unitAmenities: ["In-unit W/D"],
      utilitiesIncluded: "Water, trash",
      depositInfo: "$500",
      applicationRequirements: "Proof of income",
      neighborhoodInfo: "Near campus",
      tourInfo: "Tours daily",
    });
    expect(full.score).toBe(100);
    expect(full.missingCritical).toEqual([]);
  });

  it("does NOT count a floor plan that lacks a square footage", () => {
    const res = computeKbCompleteness({
      floorPlans: [{ type: "Triple", squareFeet: null }],
    });
    const fp = res.items.find((i) => i.key === "floorPlans");
    expect(fp?.done).toBe(false);
    expect(res.missingCritical).toContain(fp?.label);
  });

  it("counts a floor plan only with BOTH a type and a positive square footage", () => {
    expect(isUsableFloorPlan({ type: "Single", squareFeet: 200 })).toBe(true);
    expect(isUsableFloorPlan({ type: "Single", squareFeet: 0 })).toBe(false);
    expect(isUsableFloorPlan({ type: "", squareFeet: 200 })).toBe(false);
    expect(isUsableFloorPlan({ type: "Single", squareFeet: null })).toBe(false);
  });
});

describe("parseFloorPlans", () => {
  it("drops entries without a usable type and coerces numerics", () => {
    const parsed = parseFloorPlans([
      { type: "Double", squareFeet: 420, bedrooms: 2, priceMinCents: 120000 },
      { type: "", squareFeet: 200 },
      { squareFeet: 999 },
      "garbage",
      null,
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.type).toBe("Double");
    expect(parsed[0]?.squareFeet).toBe(420);
    expect(parsed[0]?.priceMinCents).toBe(120000);
  });

  it("returns [] for non-array input", () => {
    expect(parseFloorPlans(null)).toEqual([]);
    expect(parseFloorPlans(undefined)).toEqual([]);
    expect(parseFloorPlans("nope")).toEqual([]);
  });
});
