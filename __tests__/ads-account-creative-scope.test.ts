import { describe, expect, it } from "vitest";
import {
  adsAccountPropertyClause,
  adsCreativePropertyClause,
} from "@/lib/integrations/ads-property-rollup";

// Southgate and The Lair each have their own Google Ads account. A Lair-only
// agent saw Southgate's account card (name, id, sync error), and ads with no
// campaign link showed under whichever property was picked.

const lairOnly = { propertyId: { in: ["p-lair"] } };
const portfolio = { OR: [{ propertyId: { in: ["p-southgate", "p-lair"] } }, { propertyId: null }] };

describe("ad account cards on /portal/ads", () => {
  it("narrowed: only accounts with a campaign in scope", () => {
    expect(adsAccountPropertyClause(true, lairOnly)).toEqual({ adCampaigns: { some: lairOnly } });
  });
  it("unrestricted, nothing picked: every account", () => {
    expect(adsAccountPropertyClause(false, portfolio)).toEqual({});
  });
});

describe("ads (creatives) on /portal/ads", () => {
  it("narrowed: drops ads with no campaign link", () => {
    expect(adsCreativePropertyClause(true, lairOnly)).toEqual({ campaign: lairOnly });
  });
  it("unrestricted, nothing picked: unlinked ads stay visible", () => {
    expect(adsCreativePropertyClause(false, portfolio)).toEqual({
      OR: [{ campaignId: null }, { campaign: portfolio }],
    });
  });
});
