import { describe, expect, it } from "vitest";
import { adsInsightPropertyClause } from "@/lib/integrations/ads-property-rollup";

// Two buildings, Southgate and The Lair. With The Lair picked on
// /portal/ads, the suggestion list used to keep every visible building's
// suggestions (e.g. "Southgate | Search spent $400 with zero leads").

const visible = [{ id: "p-southgate" }, { id: "p-lair" }];
const full = { allowedPropertyIds: null };

describe("adsInsightPropertyClause", () => {
  it("a picked property narrows suggestions to it plus org-level ones", () => {
    expect(adsInsightPropertyClause(full, ["p-lair"], visible)).toEqual({
      OR: [{ propertyId: null }, { propertyId: { in: ["p-lair"] } }],
    });
  });

  it("no pick keeps every visible property", () => {
    expect(adsInsightPropertyClause(full, null, visible)).toEqual({
      OR: [{ propertyId: null }, { propertyId: { in: ["p-southgate", "p-lair"] } }],
    });
  });

  it("a restricted user picking a building outside the grant gets no property rows", () => {
    expect(adsInsightPropertyClause({ allowedPropertyIds: ["p-lair"] }, ["p-southgate"], [{ id: "p-lair" }])).toEqual({
      OR: [{ propertyId: null }, { propertyId: { in: [] } }],
    });
  });
});
