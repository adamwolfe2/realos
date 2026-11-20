import { describe, expect, it } from "vitest";
import { campaignLeadWhere } from "@/lib/integrations/ad-lead-source";

// Southgate and The Lair each run their own Google Ads account with a
// cloned campaign called "Search | Fall 27". The campaign page for the
// Lair's copy credited Southgate's leads too, because only the tag matched.

const tagClause = {
  OR: [
    { sourceDetail: { in: ["Search | Fall 27", "111"] } },
    { attribution: { path: ["first", "utmCampaign"], equals: "Search | Fall 27" } },
    { attribution: { path: ["first", "utmCampaign"], equals: "111" } },
  ],
};

describe("campaignLeadWhere per property", () => {
  it("a property campaign only credits that property's leads and unassigned ones", () => {
    const where = campaignLeadWhere({ name: "Search | Fall 27", externalCampaignId: "111", propertyId: "p-lair" });
    expect(where).toEqual({
      AND: [tagClause, { OR: [{ propertyId: "p-lair" }, { propertyId: null }] }],
    });
  });

  it("a whole-portfolio campaign still credits every property", () => {
    const where = campaignLeadWhere({ name: "Search | Fall 27", externalCampaignId: "111", propertyId: null });
    expect(where).toEqual({ AND: [tagClause] });
  });
});
