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
      totalUnits: 10,
      listings: [{ priceCents: 76500, availableFrom: new Date("2026-07-01") }],
    },
    {
      id: "b",
      slug: "building-b",
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

  it("without ?property=, a genuine single-property fallback pools (legacy)", async () => {
    h.findUnique.mockResolvedValue({ ...ORG, properties: [ORG.properties[0]] });
    const res = await GET(req("slug=building-a"));
    const json = await res.json();
    expect(json.lowestRent).toBe(765);
  });
});
