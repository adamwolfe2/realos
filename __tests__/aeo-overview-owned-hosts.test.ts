import { describe, it, expect, vi } from "vitest";

// Regression (multi-property): the Google AI Overview "cited" flag compared
// cited URLs only against the org's primary DomainBinding. In an org with two
// ACTIVE properties on separate websites, a citation of property B's own site
// was stored as cited=false.

const created: Array<{ query: string; cited: boolean }> = [];

vi.mock("@/lib/db", () => ({
  prisma: {
    seoQuery: {
      findMany: vi.fn(async () => [
        { query: "student housing berkeley", clicks: 10, impressions: 100, position: 4 },
      ]),
    },
    aeoMentionSnapshot: { findMany: vi.fn(async () => []) },
    onPageAudit: { findMany: vi.fn(async () => []) },
    aeoOpportunityScore: { upsert: vi.fn(async () => ({})) },
    aeoOverviewSnapshot: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: { data: { query: string; cited: boolean } }) => {
        created.push({ query: data.query, cited: data.cited });
        return data;
      }),
    },
    domainBinding: {
      findFirst: vi.fn(async () => ({ hostname: "alpha-house.com" })),
    },
    property: {
      findMany: vi.fn(async () => [
        { websiteUrl: "https://www.alpha-house.com" },
        { websiteUrl: "https://beta-house.com/" },
      ]),
    },
  },
}));

vi.mock("@/lib/aeo/engines", () => ({ resolveEngineSource: () => "dataforseo" }));
vi.mock("@/lib/seo/dataforseo", () => ({
  isDataforSeoConfigured: () => true,
  fetchAiKeywordVolume: vi.fn(async () => ({ ok: true, data: [], costUsd: 0 })),
  fetchSerpAiSummary: vi.fn(async () => ({
    ok: true,
    costUsd: 0.01,
    data: {
      summary: "Beta House is close to campus.",
      citedUrls: ["https://www.beta-house.com/floor-plans"],
    },
  })),
}));

const { scoreOrgOpportunities } = await import("@/lib/aeo/score-opportunities");

describe("AI Overview citation across a two-property org", () => {
  it("counts a citation of a non-primary property's website as cited", async () => {
    const r = await scoreOrgOpportunities("o1");
    expect(r.errors).toEqual([]);
    expect(created).toEqual([{ query: "student housing berkeley", cited: true }]);
  });
});
