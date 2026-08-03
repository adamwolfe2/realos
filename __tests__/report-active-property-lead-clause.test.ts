import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// SG Real Estate lead/application overclaim (2026-08-01 forensic audit):
// AppFolio syncs the WHOLE portfolio account-wide, so the org-wide client
// report's Lead/Application queries pulled in rows attached to EXCLUDED
// (curated-out junk sub-records) and IMPORTED (not-yet-launched) properties
// -- 766 of 929 reported leads, ~791 of 895 applications, a ~6x overclaim.
// Fix: every Lead/Application-shaped query in generate.ts spreads
// activePropertyClause(scope) so org-wide reports only see
// ACTIVE-lifecycle properties (the ones the client actually set up).
// Visitor queries joined the gate 2026-08-02 once propertyId stamping at
// ingest + the single-property backfill made it safe.
//
// This locks the gate to the REAL prisma calls generateReportSnapshot
// makes (not just the helper in isolation), so a future edit that drops
// the `...activePropertyClause(scope)` spread from a query fails loud.
// Every model/method generateReportSnapshot touches gets an auto-mock with
// a harmless empty/zero default; only the calls under test get inspected.
// ---------------------------------------------------------------------------

function autoMockPrisma() {
  const defaultFor = (method: string) => {
    switch (method) {
      case "count":
        return vi.fn(async () => 0);
      case "$queryRaw":
      case "$queryRawUnsafe":
        // Root-level prisma methods, not models — must be callable or the
        // Promise.all inside buildVisitorStats throws and every query after
        // the raw call silently never registers (the caller swallows it).
        return vi.fn(async () => [{ count: BigInt(0) }]);
      case "aggregate":
        return vi.fn(async () => ({ _sum: {}, _avg: {}, _count: { _all: 0 } }));
      case "groupBy":
        return vi.fn(async () => []);
      case "findMany":
        return vi.fn(async () => []);
      default:
        // findFirst / findUnique / anything else this file might add later.
        return vi.fn(async () => null);
    }
  };
  return new Proxy(
    {} as Record<string, Record<string, ReturnType<typeof vi.fn>>>,
    {
      get(models, model: string) {
        // prisma.$queryRaw / $queryRawUnsafe are functions on the client
        // root, not models — return the fn directly instead of a model
        // proxy (which isn't callable).
        if (model.startsWith("$")) {
          if (!(model in models)) {
            models[model] = defaultFor(model) as unknown as Record<
              string,
              ReturnType<typeof vi.fn>
            >;
          }
          return models[model];
        }
        if (!(model in models)) {
          models[model] = new Proxy(
            {} as Record<string, ReturnType<typeof vi.fn>>,
            {
              get(methods, method: string) {
                if (!(method in methods)) methods[method] = defaultFor(method);
                return methods[method];
              },
            },
          );
        }
        return models[model];
      },
    },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = autoMockPrisma();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

const { generateReportSnapshot } = await import("@/lib/reports/generate");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateReportSnapshot — org-wide report gates Lead/Application queries to ACTIVE properties", () => {
  it("lead.count (KPI + chatbot-source + funnel total) is gated every time it's called", async () => {
    await generateReportSnapshot("org-1", "monthly", { skipAi: true });

    const calls = mockPrisma.lead.count.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [args] of calls) {
      expect(args.where).toMatchObject({ property: { lifecycle: "ACTIVE" } });
    }
  });

  it("application.count is gated every time it's called", async () => {
    await generateReportSnapshot("org-1", "monthly", { skipAi: true });

    const calls = mockPrisma.application.count.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [args] of calls) {
      expect(args.where).toMatchObject({ property: { lifecycle: "ACTIVE" } });
    }
  });

  it("lead.groupBy(propertyId) attribution table is gated", async () => {
    await generateReportSnapshot("org-1", "monthly", { skipAi: true });

    const propertyGroupByCalls = mockPrisma.lead.groupBy.mock.calls.filter(
      ([args]: [{ by?: string[] }]) => args.by?.includes("propertyId"),
    );
    expect(propertyGroupByCalls.length).toBe(1);
    expect(propertyGroupByCalls[0][0].where).toMatchObject({
      property: { lifecycle: "ACTIVE" },
    });
  });

  it("lead.groupBy(status) funnel is gated", async () => {
    await generateReportSnapshot("org-1", "monthly", { skipAi: true });

    const statusGroupByCalls = mockPrisma.lead.groupBy.mock.calls.filter(
      ([args]: [{ by?: string[] }]) => args.by?.includes("status"),
    );
    expect(statusGroupByCalls.length).toBe(1);
    expect(statusGroupByCalls[0][0].where).toMatchObject({
      property: { lifecycle: "ACTIVE" },
    });
  });

  it("chatbot conversation aggregate keeps null-propertyId rows (widget predates property stamping) alongside ACTIVE-property rows", async () => {
    await generateReportSnapshot("org-1", "monthly", { skipAi: true });

    const [args] = mockPrisma.chatbotConversation.aggregate.mock.calls[0];
    expect(args.where.OR).toEqual([
      { propertyId: null },
      { property: { lifecycle: "ACTIVE" } },
    ]);
  });

  it("visitor.count (KPI identified-visitor counts + visitor stats) is gated every time it's called", async () => {
    await generateReportSnapshot("org-1", "monthly", { skipAi: true });

    const calls = mockPrisma.visitor.count.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [args] of calls) {
      expect(args.where).toMatchObject({ property: { lifecycle: "ACTIVE" } });
    }
  });

  it("visitor.groupBy + visitor.findMany in the deep stats block are gated too", async () => {
    // buildVisitorStats bails (returns undefined) when identifiedTotal is
    // 0, which would skip the groupBy/findMany block entirely — force a
    // non-zero count so the second Promise.all actually runs and records.
    // (clearAllMocks does NOT drop implementations, so restore in finally.)
    mockPrisma.visitor.count.mockImplementation(async () => 3);
    try {
      await generateReportSnapshot("org-1", "monthly", { skipAi: true });

      for (const method of ["groupBy", "findMany"] as const) {
        const calls = mockPrisma.visitor[method].mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        for (const [args] of calls) {
          expect(args.where).toMatchObject({
            property: { lifecycle: "ACTIVE" },
          });
        }
      }
    } finally {
      mockPrisma.visitor.count.mockImplementation(async () => 0);
    }
  });

  it("tracedSignedLeads is omitted at zero (never zero-padded) and its query requires a Resident link + ACTIVE property", async () => {
    const snap = await generateReportSnapshot("org-1", "monthly", {
      skipAi: true,
    });
    // Default mocks count 0 → the proof claim must be ABSENT, not "0".
    expect(snap.tracedSignedLeads).toBeUndefined();

    mockPrisma.lead.count.mockImplementation(async () => 2);
    try {
      const snap2 = await generateReportSnapshot("org-1", "monthly", {
        skipAi: true,
      });
      expect(snap2.tracedSignedLeads).toBe(2);
      const tracedCalls = mockPrisma.lead.count.mock.calls.filter(
        ([args]: [{ where: { residents?: unknown } }]) => args.where.residents,
      );
      expect(tracedCalls.length).toBeGreaterThan(0);
      for (const [args] of tracedCalls) {
        expect(args.where).toMatchObject({
          residents: { some: {} },
          property: { lifecycle: "ACTIVE" },
        });
      }
    } finally {
      mockPrisma.lead.count.mockImplementation(async () => 0);
    }
  });

  it("property-scoped reports are unchanged: no lifecycle gate, still filtered to the one property", async () => {
    await generateReportSnapshot("org-1", "monthly", {
      skipAi: true,
      propertyId: "prop-a",
    });

    for (const model of ["lead", "visitor"] as const) {
      const calls = mockPrisma[model].count.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const [args] of calls) {
        expect(args.where.property).toBeUndefined();
        expect(args.where.propertyId).toBe("prop-a");
      }
    }
  });
});
