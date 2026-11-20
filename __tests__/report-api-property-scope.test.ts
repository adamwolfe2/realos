import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// /api/portal/reports per property (2026-11). Org has properties A and B.
// Before: POST could only create org-wide reports (403 for every restricted
// user, even for their own property) and GET returned [] to restricted users
// and had no property filter. Now each property's reports can be created and
// listed independently, and a user restricted to A gets A only.
// ---------------------------------------------------------------------------

type Scope = {
  orgId: string;
  userId: string;
  allowedPropertyIds: string[] | null;
  isAgency: boolean;
  isImpersonating: boolean;
};

const h = vi.hoisted(() => ({
  scope: null as unknown as Scope,
  generate: vi.fn(),
  db: {
    property: { findFirst: vi.fn() },
    clientReport: { create: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/tenancy/scope", () => ({
  requireScope: async () => h.scope,
  requireWritableWorkspace: async () => h.scope,
  ForbiddenError: class extends Error {},
}));
vi.mock("@/lib/reports/generate", () => ({
  generateReportSnapshot: (...a: unknown[]) => h.generate(...a),
}));
vi.mock("@/lib/reports/token", () => ({ generateShareToken: () => "tok" }));
vi.mock("@/lib/billing/gate", () => ({
  checkAiBillingGate: async () => ({ allowed: true }),
  aiBillingDeniedResponseBody: () => ({ error: "x" }),
}));
vi.mock("@/lib/rate-limit", () => ({
  aiCallLimiter: "l",
  checkRateLimit: async () => ({ allowed: true, reset: 0 }),
  rateLimited: () => new Response(null, { status: 429 }),
}));

const { GET, POST } = await import("@/app/api/portal/reports/route");

const operator = (allowed: string[] | null): Scope => ({
  orgId: "org-1",
  userId: "u1",
  allowedPropertyIds: allowed,
  isAgency: true,
  isImpersonating: false,
});

const post = (body: unknown) =>
  POST(new Request("https://x/api/portal/reports", { method: "POST", body: JSON.stringify(body) }) as never);
const get = (qs = "") => GET(new Request(`https://x/api/portal/reports${qs}`) as never);

beforeEach(() => {
  vi.clearAllMocks();
  h.db.property.findFirst.mockImplementation(async ({ where }: { where: { id: string; orgId: string } }) =>
    ["pA", "pB"].includes(where.id) && where.orgId === "org-1" ? { id: where.id } : null,
  );
  h.generate.mockResolvedValue({
    periodStart: "2026-10-01T00:00:00.000Z",
    periodEnd: "2026-10-31T00:00:00.000Z",
  });
  h.db.clientReport.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "r1", ...data }));
  h.db.clientReport.findMany.mockResolvedValue([]);
});

describe("POST /api/portal/reports with propertyId", () => {
  it("unrestricted: creates a report for property B, scoped to B", async () => {
    h.scope = operator(null);
    const res = await post({ kind: "monthly", propertyId: "pB" });
    expect(res.status).toBe(201);
    expect(h.generate).toHaveBeenCalledWith("org-1", "monthly", { propertyId: "pB" });
    expect(h.db.clientReport.create.mock.calls[0][0].data.propertyId).toBe("pB");
  });

  it("restricted to A: can create A's report", async () => {
    h.scope = operator(["pA"]);
    const res = await post({ kind: "weekly", propertyId: "pA" });
    expect(res.status).toBe(201);
    expect(h.db.clientReport.create.mock.calls[0][0].data.propertyId).toBe("pA");
  });

  it("restricted to A: B and org-wide are refused before any generation", async () => {
    h.scope = operator(["pA"]);
    expect((await post({ kind: "weekly", propertyId: "pB" })).status).toBe(403);
    expect((await post({ kind: "weekly" })).status).toBe(403);
    expect(h.generate).not.toHaveBeenCalled();
    expect(h.db.clientReport.create).not.toHaveBeenCalled();
  });

  it("an off-org propertyId is refused", async () => {
    h.scope = operator(null);
    expect((await post({ kind: "weekly", propertyId: "pOther" })).status).toBe(403);
    expect(h.generate).not.toHaveBeenCalled();
  });
});

describe("GET /api/portal/reports property scope", () => {
  it("restricted to A: lists A's reports only (no org-wide, no B)", async () => {
    h.scope = operator(["pA"]);
    await get();
    expect(h.db.clientReport.findMany.mock.calls[0][0].where.propertyId).toBe("pA");
  });

  it("restricted to A asking for B: matches nothing", async () => {
    h.scope = operator(["pA"]);
    await get("?propertyId=pB");
    expect(h.db.clientReport.findMany.mock.calls[0][0].where.propertyId).toBe("__no_property_access__");
  });

  it("unrestricted: ?propertyId=pB filters to B; no param lists everything incl. org-wide", async () => {
    h.scope = operator(null);
    await get("?propertyId=pB");
    expect(h.db.clientReport.findMany.mock.calls[0][0].where.propertyId).toBe("pB");
    await get();
    expect(h.db.clientReport.findMany.mock.calls[1][0].where).not.toHaveProperty("propertyId");
  });
});
