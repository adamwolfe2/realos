import { beforeEach, describe, expect, it, vi } from "vitest";

// S2 of plans/ads-read-only: per-ad creatives are a read-only mirror.

vi.mock("server-only", () => ({}));

const db = {
  adAccount: { findUnique: vi.fn(), updateMany: vi.fn() },
  adCampaign: { findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  adMetricDaily: { upsert: vi.fn(), aggregate: vi.fn() },
  adCreative: { findMany: vi.fn(), upsert: vi.fn() },
  adCreativeMetricDaily: { upsert: vi.fn() },
  auditEvent: { create: vi.fn() },
};
vi.mock("@/lib/db", () => ({ prisma: db }));

const metaCreds = { systemUserAccessToken: "tok" };
const googleCreds = {
  developerToken: "dev",
  refreshToken: "refresh-token-value-long-enough",
  oauthClientId: "cid",
  oauthClientSecret: "sec",
};

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => "" });

beforeEach(() => {
  fetchMock.mockReset();
  for (const model of Object.values(db)) for (const fn of Object.values(model)) fn.mockReset();
});

describe("Meta per-ad fetchers", () => {
  it("maps ads + creative, detects carousel/video/image/text, reads only", async () => {
    const { fetchMetaAds } = await import("@/lib/integrations/meta-ads");
    fetchMock.mockResolvedValueOnce(json({
      data: [
        { id: "a1", name: "Carousel", status: "ACTIVE", campaign_id: "c1", creative: { thumbnail_url: "https://cdn/t1", object_story_spec: { link_data: { link: "https://x/1", name: "Tour today", message: "Body 1", child_attachments: [{}, {}] } } } },
        { id: "a2", name: "Video", status: "PAUSED", campaign_id: "c1", creative: { thumbnail_url: "https://cdn/t2", video_id: "v9", object_story_spec: { video_data: { title: "Watch", message: "Body 2", call_to_action: { type: "LEARN_MORE", value: { link: "https://x/2" } } } } } },
        { id: "a3", status: "ACTIVE", creative: { image_url: "https://cdn/i3", title: "Static", body: "Body 3", call_to_action_type: "SIGN_UP" } },
        { id: "a4", status: "ACTIVE", creative: { title: "Just words" } },
      ],
    }));
    const ads = await fetchMetaAds(metaCreds, "123");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toContain("/act_123/ads?");
    expect(init?.method ?? "GET").toBe("GET");
    expect(ads.map((a) => a.format)).toEqual(["carousel", "video", "image", "text"]);
    expect(ads[0]).toMatchObject({ externalAdId: "a1", externalCampaignId: "c1", headline: "Tour today", body: "Body 1", landingUrl: "https://x/1", thumbnailUrl: "https://cdn/t1" });
    expect(ads[1]).toMatchObject({ videoId: "v9", ctaType: "LEARN_MORE", landingUrl: "https://x/2", headline: "Watch" });
    expect(ads[2]).toMatchObject({ imageUrl: "https://cdn/i3", thumbnailUrl: "https://cdn/i3", ctaType: "SIGN_UP", externalCampaignId: null, name: "(unnamed ad)" });
  });

  it("pulls insights at ad level and counts leads as conversions", async () => {
    const { fetchMetaAdDailyMetrics } = await import("@/lib/integrations/meta-ads");
    fetchMock.mockResolvedValueOnce(json({
      data: [
        { ad_id: "a1", date_start: "2026-10-27", impressions: "1000", clicks: "40", spend: "12.34", actions: [{ action_type: "lead", value: "3" }, { action_type: "link_click", value: "40" }] },
        { date_start: "2026-10-27", impressions: "5" },
      ],
    }));
    const rows = await fetchMetaAdDailyMetrics(metaCreds, "act_123", new Date("2026-10-27T00:00:00Z"), new Date("2026-10-28T00:00:00Z"));
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("level=ad");
    expect(url).toContain(encodeURIComponent('{"since":"2026-10-27","until":"2026-10-28"}'));
    expect(rows).toEqual([{ externalAdId: "a1", date: "2026-10-27", impressions: 1000, clicks: 40, spendCents: 1234, conversions: 3 }]);
  });
});

describe("Google per-ad fetchers", () => {
  it("maps ad_group_ad rows to creatives via searchStream (no mutate)", async () => {
    const { fetchGoogleAdsAds } = await import("@/lib/integrations/google-ads");
    fetchMock
      .mockResolvedValueOnce(json({ access_token: "at", expires_in: 3600 }))
      .mockResolvedValueOnce(json([{ results: [
        { adGroupAd: { status: "ENABLED", ad: { id: "g1", type: "RESPONSIVE_SEARCH_AD", finalUrls: ["https://x/g1"], responsiveSearchAd: { headlines: [{ text: "Lease now" }], descriptions: [{ text: "Desc" }] } } }, campaign: { id: "c9" } },
        { adGroupAd: { status: "PAUSED", ad: { id: "g2", name: "Display", type: "RESPONSIVE_DISPLAY_AD", responsiveDisplayAd: { headlines: [{ text: "H" }], descriptions: [], callToActionText: "Apply" } } }, campaign: { id: "c9" } },
        { adGroupAd: { status: "ENABLED", ad: { type: "VIDEO_RESPONSIVE_AD" } } },
      ] }]));
    const ads = await fetchGoogleAdsAds(googleCreds, "1234567890");
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toMatch(/customers\/1234567890\/googleAds:searchStream$/);
    expect(String(init.body)).toContain("FROM ad_group_ad");
    expect(ads).toHaveLength(2);
    expect(ads[0]).toMatchObject({ externalAdId: "g1", externalCampaignId: "c9", name: "Lease now", format: "text", headline: "Lease now", body: "Desc", landingUrl: "https://x/g1", status: "ENABLED" });
    expect(ads[1]).toMatchObject({ externalAdId: "g2", name: "Display", format: "image", ctaType: "Apply", body: null });
  });

  it("maps per-ad daily metrics", async () => {
    const { fetchGoogleAdsAdDailyMetrics } = await import("@/lib/integrations/google-ads");
    fetchMock.mockResolvedValueOnce(json([{ results: [
      { adGroupAd: { ad: { id: "g1" } }, segments: { date: "2026-10-27" }, metrics: { impressions: "200", clicks: "10", costMicros: "2500000", conversions: 1.5 } },
    ] }]));
    const rows = await fetchGoogleAdsAdDailyMetrics(googleCreds, "1234567890", new Date("2026-10-27T00:00:00Z"), new Date("2026-10-27T00:00:00Z"));
    expect(rows).toEqual([{ externalAdId: "g1", date: "2026-10-27", impressions: 200, clicks: 10, spendCents: 250, conversions: 1.5 }]);
  });
});

describe("runAdsSyncForAccount creative phase", () => {
  const account = { id: "acct", orgId: "org1", platform: "META", externalAccountId: "123", lastSyncAt: new Date("2026-10-27T00:00:00Z"), accessStatus: "active" };

  function arrangeAccount() {
    db.adAccount.findUnique.mockResolvedValue(account);
    db.adCampaign.findMany.mockResolvedValue([{ id: "camp-db", externalCampaignId: "c1" }]);
    db.adCampaign.upsert.mockResolvedValue({});
    db.adMetricDaily.upsert.mockResolvedValue({});
    db.adMetricDaily.aggregate.mockResolvedValue({ _sum: {}, _max: {} });
    db.adCampaign.update.mockResolvedValue({});
    db.adAccount.updateMany.mockResolvedValue({ count: 1 });
    db.auditEvent.create.mockResolvedValue({});
  }

  it("stamps creatives with the account's org, links campaigns, and advances the watermark", async () => {
    vi.doMock("@/lib/integrations/meta-ads", async (orig) => ({
      ...(await orig<typeof import("@/lib/integrations/meta-ads")>()),
      resolveMetaAdsCredentials: async () => metaCreds,
    }));
    vi.resetModules();
    const { runAdsSyncForAccount } = await import("@/lib/integrations/ads-sync");
    arrangeAccount();
    db.adCreative.upsert.mockResolvedValue({});
    db.adCreative.findMany.mockResolvedValue([{ id: "cr-db", externalAdId: "a1" }]);
    db.adCreativeMetricDaily.upsert.mockResolvedValue({});
    fetchMock
      .mockResolvedValueOnce(json({ data: [{ id: "c1", name: "Camp", status: "ACTIVE" }] }))
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(json({ data: [{ id: "a1", name: "Ad", status: "ACTIVE", campaign_id: "c1", creative: { image_url: "https://cdn/i" } }] }))
      .mockResolvedValueOnce(json({ data: [{ ad_id: "a1", date_start: "2026-10-27", impressions: "10", clicks: "2", spend: "1.00", actions: [] }] }));

    const result = await runAdsSyncForAccount("acct");
    expect(result.ok).toBe(true);
    expect(result.stats).toMatchObject({ creativesUpserted: 1, creativeMetricRowsUpserted: 1, failedWrites: 0 });
    const create = db.adCreative.upsert.mock.calls[0][0].create;
    expect(create).toMatchObject({ orgId: "org1", adAccountId: "acct", platform: "META", externalAdId: "a1", campaignId: "camp-db" });
    expect(db.adCreativeMetricDaily.upsert.mock.calls[0][0].create).toMatchObject({ orgId: "org1", adCreativeId: "cr-db", spendCents: 100, cpcCents: 50, ctr: 0.2 });
    expect(db.adAccount.updateMany.mock.calls.at(-1)?.[0].data.lastSyncAt).toBeInstanceOf(Date);
  });

  it("a creative-side API failure keeps campaign data, holds the watermark, and does not fail the run", async () => {
    vi.doMock("@/lib/integrations/meta-ads", async (orig) => ({
      ...(await orig<typeof import("@/lib/integrations/meta-ads")>()),
      resolveMetaAdsCredentials: async () => metaCreds,
    }));
    vi.resetModules();
    const { runAdsSyncForAccount } = await import("@/lib/integrations/ads-sync");
    arrangeAccount();
    fetchMock
      .mockResolvedValueOnce(json({ data: [{ id: "c1", name: "Camp", status: "ACTIVE" }] }))
      .mockResolvedValueOnce(json({ data: [{ campaign_id: "c1", date_start: "2026-10-27", impressions: "10", clicks: "1", spend: "1.00" }] }))
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { message: "(#200) Missing permission" } }), text: async () => "" });

    const result = await runAdsSyncForAccount("acct");
    expect(result.ok).toBe(true);
    expect(result.stats.metricRowsUpserted).toBe(1);
    expect(result.stats.failedWrites).toBe(1);
    expect(result.stats.warnings.join("\n")).toContain("creatives: Meta Graph API error: (#200) Missing permission");
    expect(db.adCreative.upsert).not.toHaveBeenCalled();
    const finalUpdate = db.adAccount.updateMany.mock.calls.at(-1)?.[0];
    expect(finalUpdate.data).not.toHaveProperty("lastSyncAt");
    expect(finalUpdate.data.accessStatus).toBe("active");
  });
});
