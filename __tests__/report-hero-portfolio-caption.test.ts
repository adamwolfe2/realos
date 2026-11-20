import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Portfolio report cover (2026-11): with 2+ ACTIVE properties the org-wide
// report keeps the flagship photo but must not caption it with one
// building's name. Property reports and single-building orgs unchanged.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  activeCount: 2,
  db: {
    property: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: h.db }));

const { loadReportHero } = await import("@/lib/reports/load-property-hero");

const A = {
  id: "pA",
  name: "A House",
  city: "Berkeley",
  state: "CA",
  residentialSubtype: null,
  commercialSubtype: null,
  propertyType: null,
  heroImageUrl: "https://img/a.jpg",
  heroImageOffsetX: 0,
  heroImageOffsetY: 0,
  heroImageScale: 1,
  googleAggRating: null,
};

const snap = (propertyId: string | null) =>
  ({ scope: { propertyId, propertyName: null, propertySlug: null }, properties: [] }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  h.db.property.findUnique.mockResolvedValue(A);
  h.db.property.findFirst.mockResolvedValue(A);
  h.db.property.count.mockImplementation(async () => h.activeCount);
});

describe("loadReportHero caption", () => {
  it("org-wide report, 2 ACTIVE properties: photo kept, no building caption or alt", async () => {
    h.activeCount = 2;
    const hero = await loadReportHero(snap(null), "org-1", "SG Real Estate");
    expect(hero?.imageUrl).toBe("https://img/a.jpg");
    expect(hero?.caption).toBeNull();
    expect(hero?.name).toBe("SG Real Estate");
  });

  it("org-wide report, 1 ACTIVE property: unchanged (captions the building)", async () => {
    h.activeCount = 1;
    const hero = await loadReportHero(snap(null), "org-1", "SG Real Estate");
    expect(hero?.caption).toContain("A House");
  });

  it("property report: unchanged", async () => {
    h.activeCount = 2;
    const hero = await loadReportHero(snap("pA"), "org-1", "A House");
    expect(hero?.name).toBe("A House");
    expect(hero?.caption).toBeNull();
    expect(h.db.property.count).not.toHaveBeenCalled();
  });
});
