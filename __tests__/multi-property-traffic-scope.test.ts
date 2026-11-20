import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Multi-property: property traffic/organic KPIs match SEO rows by URL. Before:
// every org DomainBinding was added to every property's URL patterns, so once
// the org bound a second domain (b-site.com for property B), property A's
// traffic tab counted all of B's pages, and rows already stamped with B's
// propertyId still counted for A when the URL matched. After: with 2+
// domains only the domain matching the property's websiteUrl is used, and
// stamped rows count only for their own property.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  domainBinding: { findMany: vi.fn() },
  property: { findFirst: vi.fn() },
  seoLandingPage: { groupBy: vi.fn(async () => []) },
  seoQuery: { groupBy: vi.fn(async () => []) },
}));
vi.mock("@/lib/db", () => ({ prisma: h }));
vi.mock("@/lib/integrations/real-ad-account", () => ({
  realAdAccountWhere: async () => ({}),
}));

const { domainsForProperty, getPropertyTraffic } = await import(
  "@/lib/properties/queries"
);

describe("domainsForProperty", () => {
  it("keeps the single-domain org behaviour unchanged", () => {
    expect(domainsForProperty(["telegraphcommons.com"], null)).toEqual([
      "telegraphcommons.com",
    ]);
  });
  it("with two domains keeps only the property's own", () => {
    expect(
      domainsForProperty(["a-site.com", "www.b-site.com"], "https://b-site.com/apply"),
    ).toEqual(["www.b-site.com"]);
    expect(domainsForProperty(["a-site.com", "b-site.com"], "a-site.com")).toEqual([
      "a-site.com",
    ]);
  });
  it("with two domains and no websiteUrl attributes none", () => {
    expect(domainsForProperty(["a-site.com", "b-site.com"], null)).toEqual([]);
  });
});

beforeEach(() => {
  h.seoLandingPage.groupBy.mockClear();
  h.seoQuery.groupBy.mockClear();
  h.domainBinding.findMany.mockResolvedValue([
    { hostname: "a-site.com" },
    { hostname: "b-site.com" },
  ]);
  h.property.findFirst.mockResolvedValue({ websiteUrl: "https://a-site.com" });
});

describe("getPropertyTraffic for property A in a two-domain org", () => {
  it("does not match property B's domain", async () => {
    const res = await getPropertyTraffic("org-1", "prop-a", {
      slug: "building-a",
      name: "Building A",
    });
    expect(res.patterns).toContain("%a-site.com%");
    expect(res.patterns).not.toContain("%b-site.com%");
  });

  it("counts A-stamped rows outright and URL-matches only unstamped rows", async () => {
    await getPropertyTraffic("org-1", "prop-a", { slug: "building-a", name: "Building A" });
    const where = (h.seoLandingPage.groupBy.mock.calls[0] as any[])[0].where;
    expect(where.orgId).toBe("org-1");
    expect(where.OR[0]).toEqual({ propertyId: "prop-a" });
    expect(where.OR[1].propertyId).toBeNull();
    expect(where.OR[1].OR.length).toBeGreaterThan(0);
    const qWhere = (h.seoQuery.groupBy.mock.calls[0] as any[])[0].where;
    expect(qWhere.OR[0]).toEqual({ propertyId: "prop-a" });
    expect(qWhere.OR[1].propertyId).toBeNull();
  });
});
