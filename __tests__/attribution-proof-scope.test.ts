import { describe, expect, it } from "vitest";
import { proofPropertyWhere } from "@/lib/attribution/proof";
import { NO_MARKETABLE_PROPERTIES } from "@/lib/tenancy/property-filter";

describe("attribution proof property scope", () => {
  it("fails closed when the caller has no active properties", () => {
    expect(proofPropertyWhere([], true)).toEqual({
      propertyId: NO_MARKETABLE_PROPERTIES,
    });
  });

  it("includes legacy org-level captures explicitly, never by widening to an empty clause", () => {
    expect(proofPropertyWhere(["prop_a", "prop_b"], true)).toEqual({
      OR: [
        { propertyId: { in: ["prop_a", "prop_b"] } },
        { propertyId: null },
      ],
    });
  });

  it("keeps PMS outcomes on required property ids only", () => {
    expect(proofPropertyWhere(["prop_a"], false)).toEqual({
      propertyId: "prop_a",
    });
  });
});
