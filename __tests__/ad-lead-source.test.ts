import { describe, expect, it } from "vitest";
import { AdPlatform, LeadSource } from "@prisma/client";
import { sourceFromCampaignName } from "@/lib/integrations/ad-lead-source";

const byName = new Map([
  ["Lair Search", AdPlatform.GOOGLE_ADS],
  ["Lair Reels", AdPlatform.META],
]);

describe("sourceFromCampaignName", () => {
  it("credits an OTHER lead whose label is a campaign name", () => {
    expect(sourceFromCampaignName({ source: LeadSource.OTHER, sourceDetail: "Lair Search" }, byName)).toBe(LeadSource.GOOGLE_ADS);
    expect(sourceFromCampaignName({ source: LeadSource.OTHER, sourceDetail: " Lair Reels " }, byName)).toBe(LeadSource.META_ADS);
  });
  it("leaves explicit sources and unknown labels alone", () => {
    expect(sourceFromCampaignName({ source: LeadSource.REFERRAL, sourceDetail: "Lair Search" }, byName)).toBe(LeadSource.REFERRAL);
    expect(sourceFromCampaignName({ source: LeadSource.OTHER, sourceDetail: "TheLairSite" }, byName)).toBe(LeadSource.OTHER);
    expect(sourceFromCampaignName({ source: LeadSource.OTHER, sourceDetail: null }, byName)).toBe(LeadSource.OTHER);
  });
});
