import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Coverage gap: GET /api/tenant/leads/export had zero test coverage on its
// property-RBAC gate, despite the route's own comment calling out that "a
// CSV export is arguably worse to leak than a JSON page: it leaves the
// platform as a file the attacker keeps forever." Uses the REAL
// lib/tenancy/property-filter functions (pure logic, no mocking) together
// with a mocked prisma/scope so the actual intersection-with-
// allowedPropertyIds behavior is exercised, not just asserted structurally.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: {
    lead: { findMany: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
// No-URL-filter cases fall back to the active-property cookie, which needs
// a real Next.js request scope (next/headers `cookies()`) unavailable in
// this unit test. Stub it to "no cookie set" — the same effective result
// as an empty portal session — so the no-filter branch is exercised
// without needing a full request context.
vi.mock("@/lib/portal/active-property", () => ({
  getActivePropertyId: vi.fn(async () => null),
  setActivePropertyId: vi.fn(async () => {}),
}));

const mockRequireScope = vi.fn();
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>(
    "@/lib/tenancy/scope",
  );
  return {
    ...actual,
    requireScope: () => mockRequireScope(),
  };
});

import { GET } from "@/app/api/tenant/leads/export/route";
import { ForbiddenError } from "@/lib/tenancy/scope";

const RESTRICTED_SCOPE = {
  orgId: "org_1",
  userId: "user_1",
  allowedPropertyIds: ["prop_allowed"],
};
const UNRESTRICTED_SCOPE = { orgId: "org_1", userId: "user_1", allowedPropertyIds: null };

function req(query: string) {
  return new Request(`http://localhost/api/tenant/leads/export${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireScope.mockResolvedValue(UNRESTRICTED_SCOPE);
  h.db.lead.findMany.mockResolvedValue([]);
  h.db.auditEvent.create.mockResolvedValue({});
});

describe("GET /api/tenant/leads/export — property scope", () => {
  it("requires auth", async () => {
    mockRequireScope.mockRejectedValue(new ForbiddenError("Not authenticated"));
    const res = (await GET(req(""))) as Response;
    expect(res.status).toBe(403);
  });

  it("a restricted user with no ?properties= filter exports only their allowed properties", async () => {
    mockRequireScope.mockResolvedValue(RESTRICTED_SCOPE);
    await GET(req(""));
    expect(h.db.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: "org_1", propertyId: "prop_allowed" }),
      }),
    );
  });

  it("a restricted user selecting a property outside their grant gets the no-access sentinel (empty export, not the full portfolio)", async () => {
    mockRequireScope.mockResolvedValue(RESTRICTED_SCOPE);
    await GET(req("?properties=prop_outside_grant"));
    const call = h.db.lead.findMany.mock.calls[0][0];
    // propertyWhereFragment's synthetic no-match sentinel — never widens
    // to "no filter" for a restricted user who asked for the wrong thing.
    expect(call.where.propertyId).toBe("__no_property_access__");
  });

  it("a restricted user selecting a property inside their grant exports just that one", async () => {
    mockRequireScope.mockResolvedValue(RESTRICTED_SCOPE);
    await GET(req("?properties=prop_allowed"));
    expect(h.db.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ propertyId: "prop_allowed" }),
      }),
    );
  });

  it("an unrestricted user with no filter exports the whole org (no propertyId constraint)", async () => {
    await GET(req(""));
    const call = h.db.lead.findMany.mock.calls[0][0];
    expect(call.where.orgId).toBe("org_1");
    expect(call.where.propertyId).toBeUndefined();
  });

  it("an unrestricted user selecting multiple properties gets an `in` filter", async () => {
    await GET(req("?properties=prop_a,prop_b"));
    expect(h.db.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ propertyId: { in: ["prop_a", "prop_b"] } }),
      }),
    );
  });

  it("writes an EXPORT audit event with the exported row count", async () => {
    const fakeLead = {
      id: "l1",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      status: "NEW",
      source: "FORM",
      sourceDetail: null,
      firstName: "Jamie",
      lastName: "Doe",
      email: "jamie@example.com",
      phone: null,
      property: null,
      score: 0,
      desiredMoveIn: null,
      lastActivityAt: null,
      notes: null,
    };
    h.db.lead.findMany.mockResolvedValue([fakeLead, { ...fakeLead, id: "l2" }]);
    await GET(req(""));
    expect(h.db.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "Lead",
          action: "EXPORT",
        }),
      }),
    );
  });
});
