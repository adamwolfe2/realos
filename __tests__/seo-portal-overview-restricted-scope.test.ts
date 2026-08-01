import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma BEFORE importing the query layer.
vi.mock("@/lib/db", () => {
  const make = () => ({
    findMany: vi.fn(async () => []),
    groupBy: vi.fn(async () => []),
  });
  return {
    prisma: {
      seoSnapshot: make(),
      seoQuery: make(),
      seoLandingPage: make(),
      seoActionRecommendation: make(),
    },
  };
});

import {
  fetchSeoActionRecommendations,
  fetchSeoSnapshots,
  fetchSeoTopQueries,
  fetchSeoTopPages,
} from "@/lib/seo/portal-overview-queries";
import { propertyWhereFragment } from "@/lib/tenancy/property-filter";
import { prisma } from "@/lib/db";
import type { ScopedContext } from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// SEO restricted-user rewire (2026-08-01). Replaces the old "blackout"
// (app/portal/seo/page.tsx used to hide every aggregate trend section for
// property-restricted users) with real propertyId scoping now that
// SeoSnapshot/SeoQuery/SeoLandingPage/SeoActionRecommendation carry that
// column (Wave 3 Phase 5).
//
// Invariant under test: a restricted user's queries must filter to their
// allowedPropertyIds and must NEVER match propertyId: null (org-wide) rows,
// which can aggregate properties outside their grant. All four SEO overview
// fetchers share the canonical propertyWhereFragment() (lib/tenancy/
// property-filter.ts) instead of a bespoke local copy — the local copy
// (deleted 2026-08-01 review fix) fell back to the user's full portfolio
// on a fully-denied selection instead of the repo-wide
// `__no_property_access__` deny sentinel.
// ---------------------------------------------------------------------------

type AnyMock = ReturnType<typeof vi.fn>;

function scope(overrides: Partial<ScopedContext> = {}): ScopedContext {
  return {
    userId: "user-1",
    clerkUserId: "clerk-1",
    orgId: "org-1",
    actualOrgId: "org-1",
    orgType: "CLIENT",
    actualOrgType: "CLIENT",
    productLine: "STUDENT_HOUSING",
    role: "CLIENT_OWNER",
    email: "a@b.com",
    isAgency: false,
    isAlPartner: false,
    isImpersonating: false,
    allowedPropertyIds: null,
    ...overrides,
  } as ScopedContext;
}

const range = { start: new Date("2026-07-01"), end: new Date("2026-07-31") };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("propertyWhereFragment — SEO overview usage", () => {
  it("restricted user, no selection: filters to their full allowed set", () => {
    const s = scope({ allowedPropertyIds: ["prop-1", "prop-2"] });
    expect(propertyWhereFragment(s, ["prop-1", "prop-2"])).toEqual({
      propertyId: { in: ["prop-1", "prop-2"] },
    });
  });

  it("restricted user, narrowed selection: filters to the intersected set", () => {
    const s = scope({ allowedPropertyIds: ["prop-1", "prop-2"] });
    expect(propertyWhereFragment(s, ["prop-1"])).toEqual({
      propertyId: "prop-1",
    });
  });

  it("unrestricted user, no selection: no propertyId filter (org-wide, includes NULL rows)", () => {
    const s = scope({ allowedPropertyIds: null });
    expect(propertyWhereFragment(s, null)).toEqual({});
  });

  it("restricted user, fully out-of-grant selection (effectiveIds: []): deny sentinel, NOT fail-open to full portfolio", () => {
    const s = scope({ allowedPropertyIds: ["prop-1", "prop-2"] });
    // effectiveIds is already the post-intersection [] a caller passes when
    // every requested property was denied.
    expect(propertyWhereFragment(s, [])).toEqual({
      propertyId: "__no_property_access__",
    });
    // Never widens to the user's full allowed set.
    expect(propertyWhereFragment(s, [])).not.toEqual({
      propertyId: { in: ["prop-1", "prop-2"] },
    });
  });
});

describe("fetchSeoSnapshots / fetchSeoTopQueries / fetchSeoTopPages — restricted scope", () => {
  it("filters SeoSnapshot to the restricted user's allowed propertyIds and excludes NULL rows", async () => {
    const s = scope({ allowedPropertyIds: ["prop-1", "prop-2"] });
    await fetchSeoSnapshots(s, ["prop-1", "prop-2"], range);

    const [args] = (prisma.seoSnapshot.findMany as AnyMock).mock.calls[0];
    expect(args.where.orgId).toBe("org-1");
    expect(args.where.propertyId).toEqual({ in: ["prop-1", "prop-2"] });
    // Never a bare {} or an OR that would admit propertyId: null.
    expect(args.where.propertyId).not.toBeUndefined();
  });

  it("filters SeoSnapshot to the deny sentinel when every selected property is out of grant", async () => {
    const s = scope({ allowedPropertyIds: ["prop-1", "prop-2"] });
    await fetchSeoSnapshots(s, [], range);

    const [args] = (prisma.seoSnapshot.findMany as AnyMock).mock.calls[0];
    expect(args.where.propertyId).toBe("__no_property_access__");
  });

  it("filters SeoQuery to the restricted user's allowed propertyIds", async () => {
    const s = scope({ allowedPropertyIds: ["prop-1"] });
    await fetchSeoTopQueries(s, ["prop-1"], range);

    const [args] = (prisma.seoQuery.groupBy as AnyMock).mock.calls[0];
    expect(args.where.orgId).toBe("org-1");
    expect(args.where.propertyId).toBe("prop-1");
  });

  it("filters SeoLandingPage to the restricted user's allowed propertyIds", async () => {
    const s = scope({ allowedPropertyIds: ["prop-1"] });
    await fetchSeoTopPages(s, ["prop-1"], range);

    const [args] = (prisma.seoLandingPage.groupBy as AnyMock).mock.calls[0];
    expect(args.where.orgId).toBe("org-1");
    expect(args.where.propertyId).toBe("prop-1");
  });

  it("unrestricted user with no selection keeps the org-wide query (propertyId untouched)", async () => {
    const s = scope({ allowedPropertyIds: null });
    await fetchSeoSnapshots(s, null, range);

    const [args] = (prisma.seoSnapshot.findMany as AnyMock).mock.calls[0];
    expect(args.where.orgId).toBe("org-1");
    expect(args.where.propertyId).toBeUndefined();
  });

  it("dedupes a superseded org-wide NULL row against a property row for the same date", async () => {
    const s = scope({ allowedPropertyIds: null });
    const day = new Date("2026-07-15");
    (prisma.seoSnapshot.findMany as AnyMock).mockResolvedValueOnce([
      { date: day, propertyId: null, totalClicks: 999, totalImpressions: 1, avgCtr: 0, avgPosition: 0 },
      { date: day, propertyId: "prop-1", totalClicks: 5, totalImpressions: 10, avgCtr: 0.1, avgPosition: 5 },
    ]);

    const rows = await fetchSeoSnapshots(s, null, range);

    expect(rows).toHaveLength(1);
    expect(rows[0].propertyId).toBe("prop-1");
    expect(rows[0].totalClicks).toBe(5);
  });
});

describe("fetchSeoActionRecommendations — restricted scope (item 1 regression)", () => {
  it("restricted user, no selection: scopes to their full allowed set, never propertyId: null or {}", async () => {
    const s = scope({ allowedPropertyIds: ["prop-1", "prop-2"] });
    await fetchSeoActionRecommendations(s, ["prop-1", "prop-2"]);

    const [args] = (prisma.seoActionRecommendation.findMany as AnyMock).mock.calls[0];
    expect(args.where.orgId).toBe("org-1");
    expect(args.where.propertyId).toEqual({ in: ["prop-1", "prop-2"] });
    expect(args.where.propertyId).not.toBeUndefined();
  });

  it("restricted user, fully out-of-grant selection: deny sentinel, not a bare {} that would admit NULL/out-of-grant rows", async () => {
    const s = scope({ allowedPropertyIds: ["prop-1", "prop-2"] });
    await fetchSeoActionRecommendations(s, []);

    const [args] = (prisma.seoActionRecommendation.findMany as AnyMock).mock.calls[0];
    expect(args.where.propertyId).toBe("__no_property_access__");
  });

  it("unrestricted user with no selection reads org-wide (propertyId untouched, NULL rows allowed)", async () => {
    const s = scope({ allowedPropertyIds: null });
    await fetchSeoActionRecommendations(s, null);

    const [args] = (prisma.seoActionRecommendation.findMany as AnyMock).mock.calls[0];
    expect(args.where.orgId).toBe("org-1");
    expect(args.where.propertyId).toBeUndefined();
  });
});
