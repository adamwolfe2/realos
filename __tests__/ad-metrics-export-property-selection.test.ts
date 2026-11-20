import { beforeEach, describe, expect, it, vi } from "vitest";

// Two buildings, Southgate and The Lair. The ads page export button on
// "The Lair · Paid ads" used to download every building's spend.

const h = vi.hoisted(() => ({
  requireScope: vi.fn(),
  db: { adMetricDaily: { findMany: vi.fn() }, auditEvent: { create: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>("@/lib/tenancy/scope");
  return { ...actual, requireScope: () => h.requireScope() };
});

const { GET } = await import("@/app/api/tenant/ad-metrics/export/route");

const campaignWhere = () => h.db.adMetricDaily.findMany.mock.calls[0][0].where.campaign;

beforeEach(() => {
  vi.clearAllMocks();
  h.db.adMetricDaily.findMany.mockResolvedValue([]);
  h.db.auditEvent.create.mockResolvedValue({});
});

describe("GET /api/tenant/ad-metrics/export with a property picked", () => {
  it("exports only the picked property's campaigns", async () => {
    h.requireScope.mockResolvedValue({ orgId: "org-1", userId: "u", allowedPropertyIds: null });
    await GET(new Request("http://localhost/api/tenant/ad-metrics/export?days=90&properties=p-lair"));
    expect(campaignWhere()).toEqual({ propertyId: "p-lair" });
  });

  it("a restricted user picking another building gets nothing, not the portfolio", async () => {
    h.requireScope.mockResolvedValue({ orgId: "org-1", userId: "u", allowedPropertyIds: ["p-lair"] });
    await GET(new Request("http://localhost/api/tenant/ad-metrics/export?properties=p-southgate"));
    expect(campaignWhere()).toEqual({ propertyId: "__no_property_access__" });
  });

  it("no pick keeps the existing whole-portfolio export", async () => {
    h.requireScope.mockResolvedValue({ orgId: "org-1", userId: "u", allowedPropertyIds: null });
    await GET(new Request("http://localhost/api/tenant/ad-metrics/export"));
    expect(campaignWhere()).toEqual({});
  });
});
