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
    },
  };
});

import {
  fetchSeoSnapshots,
  fetchSeoTopQueries,
  fetchSeoTopPages,
  seoPropertyWhereFragment,
} from "@/lib/seo/portal-overview-queries";
import { prisma } from "@/lib/db";
import type { ScopedContext } from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// SEO restricted-user rewire (2026-08-01). Replaces the old "blackout"
// (app/portal/seo/page.tsx used to hide every aggregate trend section for
// property-restricted users) with real propertyId scoping now that
// SeoSnapshot/SeoQuery/SeoLandingPage carry that column (Wave 3 Phase 5).
//
// Invariant under test: a restricted user's queries must filter to their
// allowedPropertyIds and must NEVER match propertyId: null (org-wide) rows,
// which can aggregate properties outside their grant.
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

describe("seoPropertyWhereFragment", () => {
  it("restricted user, no selection: filters to their full allowed set", () => {
    const s = scope({ allowedPropertyIds: ["prop-1", "prop-2"] });
    expect(seoPropertyWhereFragment(s, ["prop-1", "prop-2"])).toEqual({
      propertyId: { in: ["prop-1", "prop-2"] },
    });
  });

  it("restricted user, narrowed selection: filters to the intersected set", () => {
    const s = scope({ allowedPropertyIds: ["prop-1", "prop-2"] });
    expect(seoPropertyWhereFragment(s, ["prop-1"])).toEqual({
      propertyId: { in: ["prop-1"] },
    });
  });

  it("unrestricted user, no selection: no propertyId filter (org-wide, includes NULL rows)", () => {
    const s = scope({ allowedPropertyIds: null });
    expect(seoPropertyWhereFragment(s, null)).toEqual({});
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

  it("filters SeoQuery to the restricted user's allowed propertyIds", async () => {
    const s = scope({ allowedPropertyIds: ["prop-1"] });
    await fetchSeoTopQueries(s, ["prop-1"], range);

    const [args] = (prisma.seoQuery.groupBy as AnyMock).mock.calls[0];
    expect(args.where.orgId).toBe("org-1");
    expect(args.where.propertyId).toEqual({ in: ["prop-1"] });
  });

  it("filters SeoLandingPage to the restricted user's allowed propertyIds", async () => {
    const s = scope({ allowedPropertyIds: ["prop-1"] });
    await fetchSeoTopPages(s, ["prop-1"], range);

    const [args] = (prisma.seoLandingPage.groupBy as AnyMock).mock.calls[0];
    expect(args.where.orgId).toBe("org-1");
    expect(args.where.propertyId).toEqual({ in: ["prop-1"] });
  });

  it("unrestricted user with no selection keeps the org-wide query (propertyId untouched)", async () => {
    const s = scope({ allowedPropertyIds: null });
    await fetchSeoSnapshots(s, null, range);

    const [args] = (prisma.seoSnapshot.findMany as AnyMock).mock.calls[0];
    expect(args.where.orgId).toBe("org-1");
    expect(args.where.propertyId).toBeUndefined();
  });
});
