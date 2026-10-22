// A property-scoped report must not mark GA4 / GSC / ads "connected" from
// another property's window activity (#194 review, P1): presence queries use
// the same scoping as the report sections.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  adAgg: vi.fn(),
  snapAgg: vi.fn(),
  landingAgg: vi.fn(),
  queryAgg: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/integrations/real-ad-account", () => ({ realAdAccountWhere: async () => ({}) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    adAccount: { findFirst: vi.fn().mockResolvedValue(null) },
    // Stale/absent credentials: only window data can make a source connected.
    seoIntegration: { findFirst: vi.fn().mockResolvedValue(null) },
    appFolioIntegration: { findFirst: vi.fn().mockResolvedValue(null) },
    organization: { findUnique: vi.fn().mockResolvedValue(null) },
    adMetricDaily: { aggregate: m.adAgg },
    seoSnapshot: { aggregate: m.snapAgg },
    seoLandingPage: { aggregate: m.landingAgg },
    seoQuery: { aggregate: m.queryAgg },
    chatbotConversation: { count: vi.fn().mockResolvedValue(0) },
  },
}));

const { buildDataSources } = await import("@/lib/reports/generate");

const start = new Date("2026-07-19T00:00:00Z");
const end = new Date("2026-10-20T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  // Org-wide rows carry another property's traffic and spend.
  m.snapAgg.mockResolvedValue({ _sum: { organicSessions: 500, totalClicks: 80 } });
  m.adAgg.mockImplementation(async ({ where }) => ({
    _sum: { spendCents: where.campaign ? 0 : 12_000 },
  }));
  // Nothing for the report's own property.
  m.landingAgg.mockResolvedValue({ _sum: { sessions: 0 } });
  m.queryAgg.mockResolvedValue({ _sum: { clicks: 0 } });
});

describe("buildDataSources property scoping", () => {
  it("property-scoped: other properties' window data does not mark sources connected", async () => {
    const ds = await buildDataSources(
      "org1",
      {
        propertyId: "p1",
        seoLandingClause: { url: { contains: "tc" } },
        seoQueryClause: { query: { contains: "tc" } },
      },
      start,
      end,
    );
    expect(ds.ga4.connected).toBe(false);
    expect(ds.gsc.connected).toBe(false);
    expect(ds.googleAds.connected).toBe(false);
    expect(ds.metaAds.connected).toBe(false);
    for (const [arg] of m.adAgg.mock.calls) expect(arg.where.campaign).toEqual({ propertyId: "p1" });
    expect(m.landingAgg.mock.calls[0][0].where).toMatchObject({ orgId: "org1", url: { contains: "tc" } });
    expect(m.snapAgg).not.toHaveBeenCalled();
  });

  it("org-wide: org snapshot and ad data still count", async () => {
    const ds = await buildDataSources(
      "org1",
      { propertyId: null, seoLandingClause: {}, seoQueryClause: {} },
      start,
      end,
    );
    expect(ds.ga4.connected).toBe(true);
    expect(ds.gsc.connected).toBe(true);
    expect(ds.googleAds.connected).toBe(true);
  });
});
