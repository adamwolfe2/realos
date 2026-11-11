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
