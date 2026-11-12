import { AdPlatform, LeadSource } from "@prisma/client";

// Which lead source a given ad platform's leads land under. One map so the
// AdPlatform enum value (META) and the LeadSource value (META_ADS) can't
// drift apart again: two detectors keyed this on "META_ADS" and silently
// skipped every Meta campaign.
const SOURCE: Record<AdPlatform, LeadSource | null> = {
  [AdPlatform.GOOGLE_ADS]: LeadSource.GOOGLE_ADS,
  [AdPlatform.META]: LeadSource.META_ADS,
  [AdPlatform.LINKEDIN]: null,
  [AdPlatform.TIKTOK]: null,
  [AdPlatform.REDDIT]: null,
};

export function leadSourceForPlatform(platform: AdPlatform | string): LeadSource | null {
  return SOURCE[platform as AdPlatform] ?? null;
}

// A leasing-system lead whose source label is exactly one of the org's ad
// campaign names (the property site passes utm_campaign as AppFolio's
// `source`) came from that campaign's platform. Only upgrades OTHER, so an
// explicit label like "Referral" is never overwritten.
export function sourceFromCampaignName(
  current: { source: LeadSource; sourceDetail: string | null },
  campaignPlatformByName: ReadonlyMap<string, AdPlatform>,
): LeadSource {
  if (current.source !== LeadSource.OTHER || !current.sourceDetail) return current.source;
  const platform = campaignPlatformByName.get(current.sourceDetail.trim());
  return (platform && leadSourceForPlatform(platform)) ?? current.source;
}
