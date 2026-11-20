import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression (multi-property): /portal/performance passed only orgId to the
// activity feed and the headline lead-velocity chart, so with property B
// selected (or for a user restricted to B) they still showed property A's
// leads, tours and chats while the KPI tiles beside them showed B only.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  lead: { findMany: vi.fn(async (_a?: any): Promise<any> => []) },
  tour: { findMany: vi.fn(async (_a?: any): Promise<any> => []) },
  chatbotConversation: { findMany: vi.fn(async (_a?: any): Promise<any> => []) },
  // Default path: the org's marketable set is two ACTIVE properties.
  marketableOrgClause: vi.fn(async (_org: string, _f: string, o?: any) =>
    o?.includeOrgLevel
      ? { OR: [{ propertyId: { in: ["prop-a", "prop-b"] } }, { propertyId: null }] }
      : { propertyId: { in: ["prop-a", "prop-b"] } },
  ),
}));

vi.mock("@/lib/db", () => ({ prisma: h }));
vi.mock("@/lib/tenancy/property-filter", () => ({
  marketableOrgClause: h.marketableOrgClause,
}));

import { getActivityFeed, getPerformanceOverTime } from "@/lib/dashboard/queries";

const ONLY_B = { OR: [{ propertyId: "prop-b" }, { propertyId: null }] };
const ONLY_B_REQUIRED = { propertyId: "prop-b" };

beforeEach(() => vi.clearAllMocks());

describe("getActivityFeed", () => {
  it("uses the page's property clauses when given", async () => {
    await getActivityFeed("org-1", 10, {
      propertyClause: ONLY_B,
      requiredPropertyClause: ONLY_B_REQUIRED,
    });
    expect(h.lead.findMany.mock.calls[0][0].where).toMatchObject(ONLY_B);
    expect(h.chatbotConversation.findMany.mock.calls[0][0].where).toMatchObject(ONLY_B);
    expect(h.tour.findMany.mock.calls[0][0].where).toMatchObject(ONLY_B_REQUIRED);
    expect(h.marketableOrgClause).not.toHaveBeenCalled();
  });

  it("defaults to the marketable org set (both properties) without clauses", async () => {
    await getActivityFeed("org-1", 10);
    expect(h.tour.findMany.mock.calls[0][0].where).toMatchObject({
      propertyId: { in: ["prop-a", "prop-b"] },
    });
  });
});

describe("getPerformanceOverTime", () => {
  it("uses the page's property clause when given", async () => {
    await getPerformanceOverTime("org-1", 28, true, ONLY_B);
    for (const call of h.lead.findMany.mock.calls) {
      expect(call[0].where).toMatchObject(ONLY_B);
    }
    expect(h.lead.findMany).toHaveBeenCalledTimes(2);
  });
});

describe("/portal/performance wiring", () => {
  it("passes the page clauses to the activity feed and the chart", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("app/portal/performance/page.tsx", "utf8");
    expect(src).toMatch(/getActivityFeed\(scope\.orgId, 10, \{\s*propertyClause,/);
    expect(src).toMatch(/getPerformanceOverTime\([^)]*propertyClause\)/);
  });
});
