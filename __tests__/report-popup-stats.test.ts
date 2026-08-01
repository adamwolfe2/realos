import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// ---------------------------------------------------------------------------
// buildPopupStats — period-scoped Shown/CTA clicks/Converted/Dismissed for
// the ClientReport snapshot. Extracted to lib/reports/popup-stats.ts so it's
// testable without mocking the entire generate.ts dependency graph.
// ---------------------------------------------------------------------------

let mockPrisma: MockPrisma;

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

const { buildPopupStats } = await import("@/lib/reports/popup-stats");

const PERIOD_START = new Date("2026-07-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-07-29T00:00:00.000Z");

beforeEach(() => {
  mockPrisma = createMockPrisma();
});

describe("buildPopupStats", () => {
  it("returns undefined when the org has no popup campaigns at all", async () => {
    mockPrisma.popupCampaign.findMany.mockResolvedValue([]);

    const result = await buildPopupStats("org-1", null, PERIOD_START, PERIOD_END);

    expect(result).toBeUndefined();
    expect(mockPrisma.popupEvent.groupBy).not.toHaveBeenCalled();
  });

  it("returns all-zero stats (not undefined) when campaigns exist but nothing happened this period", async () => {
    mockPrisma.popupCampaign.findMany.mockResolvedValue([{ id: "camp-1" }]);
    mockPrisma.popupEvent.groupBy.mockResolvedValue([]);

    const result = await buildPopupStats("org-1", null, PERIOD_START, PERIOD_END);

    expect(result).toEqual({
      shown: 0,
      ctaClicks: 0,
      converted: 0,
      dismissed: 0,
      conversionRate: null,
    });
  });

  it("aggregates event type counts into the KPI shape and computes conversion rate", async () => {
    mockPrisma.popupCampaign.findMany.mockResolvedValue([
      { id: "camp-1" },
      { id: "camp-2" },
    ]);
    mockPrisma.popupEvent.groupBy.mockResolvedValue([
      { type: "SHOWN", _count: { _all: 200 } },
      { type: "CTA_CLICKED", _count: { _all: 40 } },
      { type: "CONVERTED", _count: { _all: 20 } },
      { type: "DISMISSED", _count: { _all: 30 } },
    ]);

    const result = await buildPopupStats("org-1", null, PERIOD_START, PERIOD_END);

    expect(result).toEqual({
      shown: 200,
      ctaClicks: 40,
      converted: 20,
      dismissed: 30,
      conversionRate: 10, // 20/200 = 10%
    });
    // Scoped to this org's campaign ids + the report window.
    expect(mockPrisma.popupEvent.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-1",
          campaignId: { in: ["camp-1", "camp-2"] },
          occurredAt: { gte: PERIOD_START, lt: PERIOD_END },
        }),
      }),
    );
  });

  it("property-scoped report includes org-wide campaigns plus that property's own", async () => {
    mockPrisma.popupCampaign.findMany.mockResolvedValue([{ id: "camp-1" }]);
    mockPrisma.popupEvent.groupBy.mockResolvedValue([]);

    await buildPopupStats("org-1", "prop-a", PERIOD_START, PERIOD_END);

    expect(mockPrisma.popupCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-1",
          OR: [{ propertyId: null }, { propertyId: "prop-a" }],
        }),
      }),
    );
  });

  it("org-wide report (no propertyId) does not filter campaigns by property", async () => {
    mockPrisma.popupCampaign.findMany.mockResolvedValue([{ id: "camp-1" }]);
    mockPrisma.popupEvent.groupBy.mockResolvedValue([]);

    await buildPopupStats("org-1", null, PERIOD_START, PERIOD_END);

    const where = mockPrisma.popupCampaign.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("OR");
  });
});
