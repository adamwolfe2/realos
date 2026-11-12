import { beforeEach, describe, expect, it, vi } from "vitest";

// Live API shapes for the versions we call (Google Ads v25, Meta v25.0),
// pushed through the real fetch + parse code. Guards the 2026-11 fixes:
// retired API versions, the v23 campaign date rename, and Meta leads that
// were counted twice.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => "" });

const googleCreds = {
  developerToken: "dev",
  refreshToken: "refresh-token-value-long-enough",
  oauthClientId: "cid",
  oauthClientSecret: "sec",
};

beforeEach(() => fetchMock.mockReset());

describe("Google Ads v25", () => {
  it("calls v25 and reads start/end from the renamed *_date_time fields", async () => {
    const { fetchGoogleAdsCampaigns } = await import("@/lib/integrations/google-ads");
    fetchMock
      .mockResolvedValueOnce(json({ access_token: "at", expires_in: 3600 }))
      .mockResolvedValueOnce(json([{
        results: [{
          campaign: {
            resourceName: "customers/111/campaigns/9",
            id: "9",
            name: "Lair | Search | Fall 27",
            status: "ENABLED",
            advertisingChannelType: "SEARCH",
            startDateTime: "2026-08-01 00:00:00",
            endDateTime: "2037-12-30 23:59:59",
          },
          campaignBudget: { amountMicros: "45000000" },
        }],
      }]));

    const [c] = await fetchGoogleAdsCampaigns(googleCreds, "111-222-3333");
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://googleads.googleapis.com/v25/customers/1112223333/googleAds:searchStream");
    expect(String(init.body)).toContain("campaign.start_date_time");
    expect(String(init.body)).not.toMatch(/campaign\.start_date[^_]/);
    expect(c).toMatchObject({ externalCampaignId: "9", objective: "SEARCH", dailyBudgetCents: 4500 });
    expect(c.startDate?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(c.endDate?.toISOString()).toBe("2037-12-30T00:00:00.000Z");
  });
});

describe("Meta v25.0", () => {
  it("calls v25.0 and counts a form lead once, not once per action type", async () => {
    const { fetchMetaAdsDailyMetrics } = await import("@/lib/integrations/meta-ads");
    fetchMock.mockResolvedValueOnce(json({
      data: [{
        campaign_id: "c1",
        date_start: "2026-11-01",
        impressions: "2400",
        clicks: "61",
        spend: "38.20",
        actions: [
          { action_type: "link_click", value: "61" },
          { action_type: "lead", value: "4" },
          { action_type: "onsite_conversion.lead_grouped", value: "3" },
        ],
      }],
    }));

    const [m] = await fetchMetaAdsDailyMetrics({ systemUserAccessToken: "tok" }, "act_55", new Date("2026-11-01"), new Date("2026-11-01"));
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/graph\.facebook\.com\/v25\.0\/act_55\/insights\?/);
    expect(m).toMatchObject({ externalCampaignId: "c1", spendCents: 3820, clicks: 61, conversions: 4 });
  });

  it("falls back to the lead parts when Meta omits the total", async () => {
    const { countConversions } = await import("@/lib/integrations/meta-ads");
    expect(countConversions([
      { action_type: "onsite_conversion.lead_grouped", value: "2" },
      { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
      { action_type: "complete_registration", value: "1" },
    ])).toBe(4);
    expect(countConversions(undefined)).toBe(0);
  });
});

describe("matchCampaignToProperty", () => {
  it("links by property name and refuses initials or ties", async () => {
    const { matchCampaignToProperty } = await import("@/lib/integrations/campaign-property-match");
    const props = [
      { id: "lair", name: "The Lair" },
      { id: "den", name: "The Den" },
      { id: "tc", name: "Telegraph Commons" },
      { id: "higby", name: "Higby" },
      { id: "higby1", name: "Higby One" },
    ];
    expect(matchCampaignToProperty("Lair | Search | Fall 27", props)).toBe("lair");
    expect(matchCampaignToProperty("Meta - The Den - Leads", props)).toBe("den");
    expect(matchCampaignToProperty("telegraph-commons_pmax", props)).toBe("tc");
    expect(matchCampaignToProperty("Higby One Retargeting", props)).toBe("higby1");
    expect(matchCampaignToProperty("Golden Bear Search", props)).toBeNull();
    expect(matchCampaignToProperty("TC - Leads", props)).toBeNull();
    expect(matchCampaignToProperty("Lair + Den Brand", props)).toBeNull();
  });
});

describe("rollupAdsByProperty", () => {
  it("splits spend by platform per property and keeps portfolio spend separate", async () => {
    const { rollupAdsByProperty, sumRollups } = await import("@/lib/integrations/ads-property-rollup");
    const rows = rollupAdsByProperty({
      properties: [{ id: "lair", name: "The Lair" }, { id: "den", name: "The Den" }],
      campaigns: [
        { id: "g1", propertyId: "lair", platform: "GOOGLE_ADS" },
        { id: "m1", propertyId: "lair", platform: "META" },
        { id: "m2", propertyId: null, platform: "META" },
      ],
      campaignTotals: [
        { campaignId: "g1", spendCents: 10000, conversions: 8 },
        { campaignId: "m1", spendCents: 5000, conversions: 12 },
        { campaignId: "m2", spendCents: 20000, conversions: 30 },
      ],
      leadGroups: [
        { propertyId: "lair", status: "NEW", count: 5 },
        { propertyId: "lair", status: "TOURED", count: 2 },
        { propertyId: "lair", status: "SIGNED", count: 1 },
        { propertyId: "den", status: "APPLIED", count: 1 },
      ],
    });
    expect(rows.map((r) => r.name)).toEqual(["The Lair", "The Den", "Whole portfolio"]);
    expect(rows[0]).toMatchObject({ googleCents: 10000, metaCents: 5000, spendCents: 15000, conversions: 20, leads: 8, tours: 3, signed: 1 });
    expect(rows[1]).toMatchObject({ spendCents: 0, leads: 1, tours: 1, signed: 0 });
    expect(rows[2]).toMatchObject({ propertyId: null, metaCents: 20000, leads: 0 });
    expect(sumRollups(rows)).toEqual({ leads: 9, tours: 4, signed: 1 });
  });
});
