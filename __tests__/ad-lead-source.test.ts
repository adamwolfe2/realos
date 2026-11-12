import { describe, expect, it } from "vitest";
import { AdPlatform, LeadSource } from "@prisma/client";
import {
  adLeadWhere,
  adPlatformOfLead,
  campaignLeadKeys,
  leadCampaignTags,
  sourceFromCampaignKey,
} from "@/lib/integrations/ad-lead-source";

const byKey = new Map([
  ["Lair Search", AdPlatform.GOOGLE_ADS],
  ["998877", AdPlatform.GOOGLE_ADS],
  ["Lair Reels", AdPlatform.META],
]);

describe("sourceFromCampaignKey", () => {
  it("credits an OTHER lead whose label is a campaign name or Google id", () => {
    expect(sourceFromCampaignKey({ source: LeadSource.OTHER, sourceDetail: "Lair Search" }, byKey)).toBe(LeadSource.GOOGLE_ADS);
    expect(sourceFromCampaignKey({ source: LeadSource.OTHER, sourceDetail: " Lair Reels " }, byKey)).toBe(LeadSource.META_ADS);
    expect(sourceFromCampaignKey({ source: LeadSource.OTHER, sourceDetail: "998877" }, byKey)).toBe(LeadSource.GOOGLE_ADS);
  });
  it("leaves explicit sources and unknown labels alone", () => {
    expect(sourceFromCampaignKey({ source: LeadSource.REFERRAL, sourceDetail: "Lair Search" }, byKey)).toBe(LeadSource.REFERRAL);
    expect(sourceFromCampaignKey({ source: LeadSource.OTHER, sourceDetail: "TheLairSite" }, byKey)).toBe(LeadSource.OTHER);
    expect(sourceFromCampaignKey({ source: LeadSource.OTHER, sourceDetail: null }, byKey)).toBe(LeadSource.OTHER);
  });
});

describe("ad lead helpers", () => {
  it("counts a lead by ad source or by a paid first touch", () => {
    expect(adLeadWhere([AdPlatform.META])).toEqual({
      AND: [{ OR: [{ source: { in: [LeadSource.META_ADS] } }, { trafficSource: { in: ["meta_ads"] } }] }],
    });
  });
  it("credits a chatbot lead from a Google ad to Google", () => {
    expect(adPlatformOfLead({ source: LeadSource.CHATBOT, trafficSource: "google_ads" })).toBe(AdPlatform.GOOGLE_ADS);
    expect(adPlatformOfLead({ source: LeadSource.META_ADS, trafficSource: null })).toBe(AdPlatform.META);
    expect(adPlatformOfLead({ source: LeadSource.CHATBOT, trafficSource: "zillow" })).toBeNull();
  });
  it("matches a campaign by name or Google campaign id", () => {
    expect(campaignLeadKeys({ name: "Fall Search ", externalCampaignId: "998877" })).toEqual(["Fall Search ", "Fall Search", "998877"]);
    expect(campaignLeadKeys({ name: "Reels", externalCampaignId: null })).toEqual(["Reels"]);
  });
  it("reads both campaign tags on a lead", () => {
    expect(leadCampaignTags({ sourceDetail: "Fall Search", attribution: { first: { utmCampaign: " Newsletter " } } })).toEqual(["newsletter", "fall search"]);
    expect(leadCampaignTags({ sourceDetail: "Lair Search", attribution: null })).toEqual(["lair search"]);
    expect(leadCampaignTags({ sourceDetail: null, attribution: { first: {} } })).toEqual([]);
  });
});

import { resolveAttribution } from "@/lib/attribution/touch";

describe("first-touch classification feeds ad credit", () => {
  const src = (first: Record<string, string>) => resolveAttribution({ touch: { first } })?.trafficSource ?? null;
  it("a Google ad click is google_ads", () => {
    expect(src({ gclid: "abc" })).toBe("google_ads");
    expect(src({ utmSource: "google", utmMedium: "cpc", utmCampaign: "998877" })).toBe("google_ads");
  });
  it("a paid Meta click is meta_ads, an organic share is not", () => {
    expect(src({ utmSource: "facebook", utmMedium: "paid", utmCampaign: "Fall Reels" })).toBe("meta_ads");
    expect(src({ fbclid: "xyz" })).not.toBe("meta_ads");
  });
});
