import { beforeEach, describe, expect, it, vi } from "vitest";

// The /portal/ads page filters on ?property= / ?properties=. A link with
// ?propertyId= is ignored, so "Lair has 5 empty units" opened the whole
// portfolio (or whichever building the sidebar switcher last held).

const h = vi.hoisted(() => ({ db: { property: { findMany: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma: h.db }));

const { vacancyNeedsBoostDetector } = await import("@/lib/insights/detectors/vacancy-needs-boost");
const { parsePropertyFilterUrlOnly } = await import("@/lib/tenancy/property-filter");

const longAgo = new Date(Date.now() - 60 * 86_400_000);

beforeEach(() => {
  h.db.property.findMany.mockResolvedValue([
    { id: "p-lair", name: "The Lair", availableCount: 5, totalUnits: 50, createdAt: longAgo, listings: [{ createdAt: longAgo }], adCampaigns: [] },
  ]);
});

describe("vacancy-needs-boost link", () => {
  it("opens /portal/ads focused on the property it is about", async () => {
    const [insight] = await vacancyNeedsBoostDetector.run("org-1", ["p-southgate", "p-lair"]);
    const params = Object.fromEntries(new URL(insight.href!, "http://x").searchParams);
    expect(parsePropertyFilterUrlOnly(params)).toEqual(["p-lair"]);
  });
});
