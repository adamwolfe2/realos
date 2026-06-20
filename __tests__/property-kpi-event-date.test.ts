import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression for P1-8: the 28-day property KPIs must count by REAL event date,
// not DB insert time (createdAt). After an AppFolio backfill dumps months of
// historical rows "now", createdAt-based windows wildly inflate a new
// customer's first-sync numbers. Leads (firstSeenAt) + applications
// (appliedAt→receivedAt→createdAt) were already fixed; this locks in TOURS
// (completedAt→scheduledAt→createdAt).
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => {
  const count = vi.fn(async () => 0);
  return {
    db: {
      domainBinding: { findMany: vi.fn(async () => []) },
      lead: { count, findMany: vi.fn(async () => []) },
      tour: { count: vi.fn(async () => 0) },
      application: { count },
      adMetricDaily: { aggregate: vi.fn(async () => ({ _sum: { spendCents: null } })) },
      seoLandingPage: { aggregate: vi.fn(async () => ({ _sum: { sessions: 0 } })) },
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/integrations/real-ad-account", () => ({
  realAdAccountWhere: async () => ({}),
}));

import { getPropertyOverviewKpis } from "@/lib/properties/queries";

const tourWhere = (): any => (h.db.tour.count.mock.calls[0] as any[])[0].where;

beforeEach(() => {
  for (const model of Object.values(h.db)) {
    for (const fn of Object.values(model)) (fn as any).mockClear?.();
  }
});

describe("property KPI tours window (P1-8)", () => {
  it("counts tours by event date (completedAt→scheduledAt→createdAt), never raw createdAt", async () => {
    await getPropertyOverviewKpis("org_1", "prop_1", { slug: "bldg", name: "Bldg" });
    const where = tourWhere();

    // No bare createdAt filter at the top level (that was the bug).
    expect(where.createdAt).toBeUndefined();

    // Fallback OR chain, in priority order.
    expect(where.OR).toEqual([
      { completedAt: { gte: expect.any(Date) } },
      { completedAt: null, scheduledAt: { gte: expect.any(Date) } },
      { completedAt: null, scheduledAt: null, createdAt: { gte: expect.any(Date) } },
    ]);

    // Still scoped to the property + tenant + counted statuses.
    expect(where.propertyId).toBe("prop_1");
    expect(where.lead).toEqual({ orgId: "org_1" });
    expect(where.status).toEqual({ in: ["SCHEDULED", "COMPLETED"] });
  });
});
