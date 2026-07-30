import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression: "Pipeline says 488 leads / 468 applications, Lead journey says
// 76 / 37 for the same 28-day window."
//
// Root cause: getFunnel() and getLeadSourceBreakdown() counted org-wide —
// every AppFolio-synced sub-record property, curated or not — while the KPI
// tiles and lead journey scope to the marketable property set. Same class as
// the SG "704 applications when only 72 belonged to Telegraph Commons" bug.
//
// The fix threads the dashboard's own scoping clauses through both helpers.
// These tests pin the pass-through: if a future edit drops the clause from
// any count, the dashboard blocks disagree again.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => {
  const fn = () => vi.fn(async (_args?: any): Promise<any> => 0);
  return {
    visitor: { count: fn() },
    visitorSession: { count: fn() },
    lead: {
      count: fn(),
      groupBy: vi.fn(async (_args?: any): Promise<any> => []),
    },
    tour: { count: fn() },
    application: { count: fn() },
    property: { findFirst: vi.fn(async (_args?: any): Promise<any> => null) },
  };
});

// First call's first argument, typed loosely for assertion drilling.
const firstArg = (m: { mock: { calls: any[][] } }): any => m.mock.calls[0][0];

vi.mock("@/lib/db", () => ({ prisma: h }));

import { getFunnel, getLeadSourceBreakdown } from "@/lib/dashboard/queries";

const ORG = "org_1";
const PROPERTY_CLAUSE = {
  OR: [{ propertyId: { in: ["prop_marketable"] } }, { propertyId: null }],
};
const REQUIRED_CLAUSE = { propertyId: { in: ["prop_marketable"] } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getFunnel scoping", () => {
  it("threads the property clauses into leads, visitors, tours, applications", async () => {
    await getFunnel(ORG, {
      periodDays: 28,
      propertyClause: PROPERTY_CLAUSE,
      requiredPropertyClause: REQUIRED_CLAUSE,
    });

    // Nullable-propertyId models get the org-rows-inclusive clause — the
    // exact clause the "Leads (28d)" tile uses, so tile === pipeline.
    expect(h.lead.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: ORG, ...PROPERTY_CLAUSE }),
      }),
    );
    expect(h.visitor.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: ORG, ...PROPERTY_CLAUSE }),
      }),
    );

    // Required-propertyId models get the plain marketable in-list.
    expect(h.application.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ...REQUIRED_CLAUSE }),
      }),
    );
    expect(h.tour.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ...REQUIRED_CLAUSE }),
      }),
    );
  });

  it("honors the range selector instead of a hardcoded 28d", async () => {
    const before = Date.now();
    await getFunnel(ORG, { periodDays: 7 });
    const leadWhere = firstArg(h.lead.count).where;
    const gte: Date = leadWhere.createdAt.gte;
    const daysBack = (before - gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysBack).toBeGreaterThan(6.9);
    expect(daysBack).toBeLessThan(7.1);
  });

  it("stays backward-compatible org-wide when no scope is passed", async () => {
    await getFunnel(ORG);
    const leadWhere = firstArg(h.lead.count).where;
    expect(leadWhere).toEqual({
      orgId: ORG,
      createdAt: { gte: expect.any(Date) },
    });
  });
});

describe("getLeadSourceBreakdown scoping", () => {
  it("threads the property clause and range into the groupBy", async () => {
    await getLeadSourceBreakdown(ORG, {
      periodDays: 90,
      propertyClause: PROPERTY_CLAUSE,
    });
    expect(h.lead.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: ORG, ...PROPERTY_CLAUSE }),
      }),
    );
  });

  it("stays org-wide 28d when no scope is passed", async () => {
    await getLeadSourceBreakdown(ORG);
    const where = firstArg(h.lead.groupBy).where;
    expect(where).toEqual({ orgId: ORG, createdAt: { gte: expect.any(Date) } });
  });

  it("surfaces sourceDetail for OTHER instead of a catch-all bucket", async () => {
    h.lead.groupBy.mockResolvedValueOnce([
      // groupBy(["source","sourceDetail"]) splits CHATBOT across page URLs —
      // they merge back under one enum label.
      { source: "CHATBOT", sourceDetail: "chatbot:pre_chat", _count: { _all: 40 } },
      { source: "CHATBOT", sourceDetail: "chatbot:/contact", _count: { _all: 5 } },
      { source: "OTHER", sourceDetail: "AppFolio application", _count: { _all: 31 } },
      { source: "OTHER", sourceDetail: null, _count: { _all: 2 } },
    ]);
    const slices = await getLeadSourceBreakdown(ORG);
    expect(slices).toEqual([
      { source: "Chatbot", count: 45 },
      // OTHER with a real origin string surfaces it as the slice label.
      { source: "AppFolio application", count: 31 },
      // Detail-less OTHER keeps the enum label.
      { source: "Other", count: 2 },
    ]);
  });
});
