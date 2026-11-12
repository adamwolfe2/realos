import { AdPlatform, LeadSource, type Prisma } from "@prisma/client";

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

// Matching a lead to one campaign. Its tag can carry the campaign name
// (Meta {{campaign.name}}, hand-tagged links) or its platform id (Google
// {campaignid} ValueTrack: Google has no campaign-name parameter).
export function campaignLeadKeys(c: { name: string; externalCampaignId: string | null }): string[] {
  return [...new Set([c.name, c.name.trim(), c.externalCampaignId ?? ""].filter(Boolean))];
}

// A leasing-system lead whose source label is one of the org's campaign keys
// (the property site handed utm_campaign to AppFolio as `source`, see the
// embeds) came from that campaign's platform. Only upgrades OTHER, so an
// explicit label like "Referral" keeps its source.
export function sourceFromCampaignKey(
  current: { source: LeadSource; sourceDetail: string | null },
  campaignPlatformByKey: ReadonlyMap<string, AdPlatform>,
): LeadSource {
  if (current.source !== LeadSource.OTHER || !current.sourceDetail) return current.source;
  const platform = campaignPlatformByKey.get(current.sourceDetail.trim());
  return (platform && leadSourceForPlatform(platform)) ?? current.source;
}

// First-touch traffic source ids (lib/attribution/source-taxonomy.ts) that
// mean a paid click on each platform.
const TRAFFIC_SOURCE: Partial<Record<AdPlatform, string>> = {
  [AdPlatform.GOOGLE_ADS]: "google_ads",
  [AdPlatform.META]: "meta_ads",
};
const AD_PLATFORMS: AdPlatform[] = [AdPlatform.GOOGLE_ADS, AdPlatform.META];

// Leads an ad platform gets credit for: the lead's source is the platform
// (AppFolio "Google", Meta lead forms) or a LeaseStack capture surface
// recorded a paid first touch from it (Lead.trafficSource). A chatbot lead
// from a Google ad keeps source CHATBOT and still counts here. Wrapped in
// AND so it can sit next to property clauses that carry their own OR.
export function adLeadWhere(platforms: AdPlatform[] = AD_PLATFORMS): Prisma.LeadWhereInput {
  const sources = platforms.map(leadSourceForPlatform).filter((s): s is LeadSource => s !== null);
  const traffic = platforms.map((p) => TRAFFIC_SOURCE[p]).filter((t): t is string => Boolean(t));
  return { AND: [{ OR: [{ source: { in: sources } }, { trafficSource: { in: traffic } }] }] };
}

// Which platform a lead counts toward: its source when that is an ad
// platform, else its paid first touch.
export function adPlatformOfLead(lead: { source: LeadSource; trafficSource: string | null }): AdPlatform | null {
  if (lead.source === LeadSource.GOOGLE_ADS) return AdPlatform.GOOGLE_ADS;
  if (lead.source === LeadSource.META_ADS) return AdPlatform.META;
  return AD_PLATFORMS.find((p) => TRAFFIC_SOURCE[p] === lead.trafficSource) ?? null;
}

// Leads credited to one campaign: the leasing system's source detail, or
// the utm_campaign of the first touch LeaseStack recorded.
export function campaignLeadWhere(c: { name: string; externalCampaignId: string | null }): Prisma.LeadWhereInput {
  const keys = campaignLeadKeys(c);
  return {
    AND: [
      {
        OR: [
          { sourceDetail: { in: keys } },
          ...keys.map((k) => ({ attribution: { path: ["first", "utmCampaign"], equals: k } })),
        ],
      },
    ],
  };
}

// Every campaign tag on a lead row (leasing-system source detail and the
// first touch's utm_campaign), trimmed and lowercased, for in-memory
// counting that agrees with campaignLeadWhere.
export function leadCampaignTags(lead: { sourceDetail: string | null; attribution: unknown }): string[] {
  const first = (lead.attribution as { first?: { utmCampaign?: unknown } } | null)?.first;
  const tag = typeof first?.utmCampaign === "string" ? first.utmCampaign : null;
  return [...new Set([tag, lead.sourceDetail].map((t) => t?.trim().toLowerCase()).filter((t): t is string => Boolean(t)))];
}
