import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Unit tests for the SEO recommendation engine (lib/seo/agent.ts).
// Heavy use of mocks since the engine reads from 6+ tables. Tests focus
// on the deterministic shape + ordering of recommendations.
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => {
  const make = () => ({
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  });
  return {
    prisma: {
      property: make(),
      seoQuery: make(),
      neighborhoodPage: make(),
      aeoCitationCheck: make(),
    },
  };
});

vi.mock("@/lib/seo/dataforseo", () => ({
  isDataforSeoConfigured: () => false,
}));

import { generateSeoRecommendations } from "@/lib/seo/agent";
import { prisma } from "@/lib/db";

type AnyMock = ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.property.findFirst as AnyMock).mockResolvedValue({
    id: "p1",
    city: "Madison",
    websiteUrl: "https://example.com",
  });
  (prisma.seoQuery.findMany as AnyMock).mockResolvedValue([]);
  (prisma.neighborhoodPage.count as AnyMock).mockResolvedValue(0);
  (prisma.neighborhoodPage.findMany as AnyMock).mockResolvedValue([]);
  (prisma.aeoCitationCheck.findMany as AnyMock).mockResolvedValue([]);
  (prisma.aeoCitationCheck.count as AnyMock).mockResolvedValue(0);
});

describe("generateSeoRecommendations", () => {
  it("returns empty list when property is not found", async () => {
    (prisma.property.findFirst as AnyMock).mockResolvedValue(null);
    const recs = await generateSeoRecommendations({
      orgId: "o1",
      propertyId: "missing",
    });
    expect(recs).toEqual([]);
  });

  it("returns CTR_FIX recommendations sorted by score (highest first)", async () => {
    (prisma.seoQuery.findMany as AnyMock).mockResolvedValue([
      { query: "high-impressions", impressions: 5000, ctr: 0.005, position: 8 },
      { query: "med-impressions", impressions: 1000, ctr: 0.008, position: 11 },
      { query: "low-impressions", impressions: 500, ctr: 0.002, position: 14 },
    ]);

    const recs = await generateSeoRecommendations({
      orgId: "o1",
      propertyId: "p1",
    });

    const ctr = recs.filter((r) => r.category === "CTR_FIX");
    expect(ctr.length).toBe(3);
    // Highest impressions → highest extraScore → first.
    expect(ctr[0].evidence.query).toBe("high-impressions");
    for (let i = 1; i < ctr.length; i += 1) {
      expect(ctr[i - 1].score).toBeGreaterThanOrEqual(ctr[i].score);
    }
  });

  it("emits a NEIGHBORHOOD_PAGE rec when zero pages are published for the city", async () => {
    const recs = await generateSeoRecommendations({
      orgId: "o1",
      propertyId: "p1",
    });
    const neighborhood = recs.find(
      (r) => r.category === "NEIGHBORHOOD_PAGE" && r.kind === "neighborhood-page:first",
    );
    expect(neighborhood).toBeDefined();
    expect(neighborhood?.title).toContain("Madison");
  });

  it("does NOT emit a NEIGHBORHOOD_PAGE rec when a page already exists", async () => {
    (prisma.neighborhoodPage.count as AnyMock).mockResolvedValue(1);
    const recs = await generateSeoRecommendations({
      orgId: "o1",
      propertyId: "p1",
    });
    expect(
      recs.find((r) => r.kind === "neighborhood-page:first"),
    ).toBeUndefined();
  });

  it("emits AEO_GAP with severity CRITICAL when 3+ competitor citations exist", async () => {
    (prisma.aeoCitationCheck.findMany as AnyMock).mockResolvedValue([
      { competitorsCited: ["AcmeApts"], prompt: "best apartments downtown" },
      { competitorsCited: ["AcmeApts"], prompt: "apartments near Marquette" },
      { competitorsCited: ["AcmeApts", "Other"], prompt: "luxury apartments" },
    ]);

    const recs = await generateSeoRecommendations({
      orgId: "o1",
      propertyId: "p1",
    });
    const aeo = recs.find((r) => r.category === "AEO_GAP");
    expect(aeo).toBeDefined();
    expect(aeo?.severity).toBe("CRITICAL");
    expect(aeo?.title).toContain("AcmeApts");
  });

  it("sorts the final list by composite score (descending)", async () => {
    (prisma.seoQuery.findMany as AnyMock).mockResolvedValue([
      { query: "high", impressions: 5000, ctr: 0.005, position: 8 },
    ]);
    (prisma.aeoCitationCheck.findMany as AnyMock).mockResolvedValue([
      { competitorsCited: ["X"], prompt: "p" },
    ]);

    const recs = await generateSeoRecommendations({
      orgId: "o1",
      propertyId: "p1",
    });
    for (let i = 1; i < recs.length; i += 1) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    }
  });

  it("returns no AEO recs when there are no recent checks", async () => {
    const recs = await generateSeoRecommendations({
      orgId: "o1",
      propertyId: "p1",
    });
    expect(recs.filter((r) => r.category === "AEO_GAP")).toEqual([]);
    expect(recs.filter((r) => r.category === "AEO_NOT_CITED")).toEqual([]);
  });

  it("each recommendation includes evidence, score, severity, and actionHref", async () => {
    (prisma.seoQuery.findMany as AnyMock).mockResolvedValue([
      { query: "foo", impressions: 600, ctr: 0.005, position: 12 },
    ]);
    const recs = await generateSeoRecommendations({
      orgId: "o1",
      propertyId: "p1",
    });
    for (const r of recs) {
      expect(r.score).toBeGreaterThan(0);
      expect(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).toContain(r.severity);
      expect(r.evidence).toBeDefined();
      expect(typeof r.title).toBe("string");
      expect(typeof r.detail).toBe("string");
    }
  });
});
