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
  property: { findFirst: vi.fn(), count: vi.fn(async () => 2) },
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

describe("domainsForProperty (gated on ACTIVE property count, not domain count)", () => {
  it("one ACTIVE property keeps every bound domain, even apex + www with no websiteUrl", () => {
    expect(
      domainsForProperty(["telegraphcommons.com", "www.telegraphcommons.com"], null, 1),
    ).toEqual(["telegraphcommons.com", "www.telegraphcommons.com"]);
    expect(
      domainsForProperty(["telegraphcommons.com", "www.telegraphcommons.com"], "https://other.example", 1),
    ).toEqual(["telegraphcommons.com", "www.telegraphcommons.com"]);
  });
  it("two ACTIVE properties keep only the property's own domain(s)", () => {
    const bound = ["a-site.com", "www.a-site.com", "b-site.com"];
    expect(domainsForProperty(bound, "https://b-site.com/apply", 2)).toEqual(["b-site.com"]);
    expect(domainsForProperty(bound, "a-site.com", 2)).toEqual(["a-site.com", "www.a-site.com"]);
  });
  it("tolerates scheme-less, www and trailing-slash websiteUrl values", () => {
    const bound = ["a-site.com", "b-site.com"];
    expect(domainsForProperty(bound, "www.b-site.com/", 2)).toEqual(["b-site.com"]);
    expect(domainsForProperty(bound, "HTTP://WWW.B-SITE.COM", 2)).toEqual(["b-site.com"]);
    expect(domainsForProperty(bound, " b-site.com/ ", 2)).toEqual(["b-site.com"]);
  });
  it("two ACTIVE properties and no websiteUrl attributes no domain", () => {
    expect(domainsForProperty(["a-site.com", "b-site.com"], null, 2)).toEqual([]);
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

describe("getPropertyTraffic in a one-property org with apex + www", () => {
  it("keeps both domains when the property has no websiteUrl", async () => {
    h.property.count.mockResolvedValue(1);
    h.domainBinding.findMany.mockResolvedValue([
      { hostname: "telegraphcommons.com" },
      { hostname: "www.telegraphcommons.com" },
    ]);
    h.property.findFirst.mockResolvedValue({ websiteUrl: null });
    const res = await getPropertyTraffic("org-1", "prop-a", { slug: "tc", name: "Telegraph Commons" });
    expect(res.patterns).toContain("%telegraphcommons.com%");
    expect(res.patterns).toContain("%www.telegraphcommons.com%");
    h.property.count.mockResolvedValue(2);
  });
});
