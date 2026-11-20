import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression (multi-property): /portal/seo/recommendations only applied the
// user's grant and ignored the property switcher, so with property B selected
// the archive still listed property A's recommendations.

const findMany = vi.fn(async () => []);
let scope: { orgId: string; allowedPropertyIds: string[] | null };
let cookieId: string | null = null;

vi.mock("@/lib/db", () => ({
  prisma: {
    seoActionRecommendation: { findMany },
    // parsePropertyFilter validates a cookie id against the org's properties.
    property: { findFirst: vi.fn(async () => ({ id: cookieId })) },
  },
}));
vi.mock("@/lib/tenancy/scope", () => ({
  requireScope: async () => scope,
  tenantWhere: (s: { orgId: string }) => ({ orgId: s.orgId }),
}));
vi.mock("@/lib/portal/active-property", () => ({
  getActivePropertyId: async () => cookieId,
  setActivePropertyId: async () => undefined,
}));
vi.mock("@/components/admin/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/app/portal/seo/recommendations/opportunities-client", () => ({
  OpportunitiesClient: () => null,
}));

const { default: OpportunitiesPage } = await import(
  "@/app/portal/seo/recommendations/page"
);

const whereOfLastCall = () =>
  (findMany.mock.calls.at(-1) as unknown as [{ where: Record<string, unknown> }])[0].where;

beforeEach(() => {
  findMany.mockClear();
  cookieId = null;
});

describe("recommendations archive in a two-property org", () => {
  it("narrows to the property picked in the URL", async () => {
    scope = { orgId: "o1", allowedPropertyIds: null };
    await OpportunitiesPage({ searchParams: Promise.resolve({ property: "B" }) });
    expect(whereOfLastCall().propertyId).toBe("B");
  });

  it("narrows to the sidebar switcher's property when the URL has none", async () => {
    scope = { orgId: "o1", allowedPropertyIds: null };
    cookieId = "B";
    await OpportunitiesPage({ searchParams: Promise.resolve({}) });
    expect(whereOfLastCall().propertyId).toBe("B");
  });

  it("shows nothing when a restricted user selects a property outside the grant", async () => {
    scope = { orgId: "o1", allowedPropertyIds: ["A"] };
    await OpportunitiesPage({ searchParams: Promise.resolve({ property: "B" }) });
    expect(whereOfLastCall().propertyId).toBe("__no_property_access__");
  });

  it("keeps a restricted user's full grant with no selection", async () => {
    scope = { orgId: "o1", allowedPropertyIds: ["A"] };
    await OpportunitiesPage({ searchParams: Promise.resolve({}) });
    expect(JSON.stringify(whereOfLastCall().propertyId)).toContain('"A"');
  });
});
