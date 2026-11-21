import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression for P1-9: the public listings-summary greeting must scope to the
// building the prospect is actually on (the widget's ?property= slug), not
// pool every property's inventory across a multi-property tenant.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { organization: { findUnique: h.findUnique } },
}));
vi.mock("@/lib/rate-limit", () => ({
  chatbotConfigLimiter: {},
  WIDGET_FALLBACK: { chatbotConfig: {} },
  getIp: () => "1.2.3.4",
  checkRateLimit: async () => ({ allowed: true }),
  rateLimited: () => new Response("rate", { status: 429 }),
}));

import { GET } from "@/app/api/public/chatbot/listings-summary/route";

const req = (qs: string) =>
  ({ nextUrl: { searchParams: new URLSearchParams(qs) } }) as never;

// Multi-property org: Building A cheap+available, Building B pricier.
const ORG = {
  id: "org_1",
  orgType: "CLIENT",
  moduleChatbot: true,
  tenantSiteConfig: { chatbotEnabled: true },
  properties: [
    {
      id: "a",
      slug: "building-a",
      name: "Building A",
      websiteUrl: "https://www.building-a-living.com",
      totalUnits: 10,
      listings: [{ priceCents: 76500, availableFrom: new Date("2026-07-01") }],
    },
    {
      id: "b",
      slug: "building-b",
      name: "Building B",
      websiteUrl: "liveatb.com",
      totalUnits: 10,
      listings: [{ priceCents: 210000, availableFrom: new Date("2026-08-01") }],
    },
  ],
};

beforeEach(() => h.findUnique.mockReset().mockResolvedValue(ORG));

describe("listings-summary per-property scoping (P1-9)", () => {
  it("scopes to the ?property= building, not the whole portfolio", async () => {
    const res = await GET(req("slug=org-slug&property=building-b"));
    const json = await res.json();
    // Building B's rent ($2100), NOT Building A's $765.
    expect(json.lowestRent).toBe(2100);
    expect(json.openCount).toBe(1);
    expect(json.nextAvailable).toBe(new Date("2026-08-01").toISOString());
  });

  it("fails closed when ?property= does not belong to the org", async () => {
    const res = await GET(req("slug=org-slug&property=not-ours"));
    const json = await res.json();
    expect(json).toEqual({ openCount: 0, lowestRent: null, nextAvailable: null });
  });

  it("without ?property=, a multi-property org does not pool every building", async () => {
    // Org slug matches no property slug: unresolved, so no building's
    // rent/availability may leak into another building's greeting.
    const res = await GET(req("slug=org-slug"));
    const json = await res.json();
    expect(json).toEqual({ openCount: 0, lowestRent: null, nextAvailable: null });
  });

  it("queries only marketable (ACTIVE) properties, so EXCLUDED rows never count", async () => {
    await GET(req("slug=org-slug&property=building-b"));
    const where = h.findUnique.mock.calls[0][0].select.properties.where;
    expect(where).toEqual({ lifecycle: { in: ["ACTIVE"] } });
  });

  it("without ?property=, a genuine single-property fallback pools (legacy)", async () => {
    h.findUnique.mockResolvedValue({ ...ORG, properties: [ORG.properties[0]] });
    const res = await GET(req("slug=building-a"));
    const json = await res.json();
    expect(json.lowestRent).toBe(765);
  });
  it("untagged embed: ?page= resolves to the building that owns that website", async () => {
    const res = await GET(req("slug=building-a&page=www.liveatb.com/floor-plans"));
    const json = await res.json();
    // Org slug matches Building A (legacy), but the page is Building B's site.
    expect(json.lowestRent).toBe(2100);
  });

  it("untagged embed on an unknown page never falls back to the flagship", async () => {
    const res = await GET(req("slug=building-a&page=brand-new-building.com/"));
    const json = await res.json();
    expect(json).toEqual({ openCount: 0, lowestRent: null, nextAvailable: null });
  });

  it("shared company site: the path picks the building, not the host owner", async () => {
    // Building A owns the host; Building B lives at /building-b on it.
    const res = await GET(req("slug=building-a&page=www.building-a-living.com/building-b"));
    const json = await res.json();
    expect(json.lowestRent).toBe(2100);
  });

  it("single-property org ignores an unknown ?page= (legacy unchanged)", async () => {
    h.findUnique.mockResolvedValue({ ...ORG, properties: [ORG.properties[0]] });
    const res = await GET(req("slug=building-a&page=anything.com/x"));
    const json = await res.json();
    expect(json.lowestRent).toBe(765);
  });
});
