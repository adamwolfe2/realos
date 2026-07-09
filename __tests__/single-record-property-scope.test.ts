import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// ---------------------------------------------------------------------------
// Regression: single-record tenant endpoints must apply the SAME property-level
// RBAC gate that the list/export/bulk endpoints do. Before this fix, a
// LEASING_AGENT scoped to Property A could read/mutate a Property-B lead (or
// visitor/conversation) in the same org by hitting the /[id] route directly —
// the handlers were org-scoped (tenantWhere) but not property-scoped.
//
// Two layers:
//   1. Behavioral — invoke the real leads/[id] handlers and assert the Prisma
//      `where` carries the property filter for a restricted scope, and does NOT
//      over-constrain an unrestricted one.
//   2. Structural — assert every affected endpoint keeps a property-fragment
//      call, so the gate can't be silently dropped later.
// ---------------------------------------------------------------------------

let mockPrisma: MockPrisma;
const mockRequireScope = vi.fn();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

class ForbiddenErrorStub extends Error {
  status = 403;
}

// Real property-filter (the thing under test) — only the scope module is mocked.
vi.mock("@/lib/tenancy/scope", () => ({
  requireScope: () => mockRequireScope(),
  requireWritableWorkspace: () => mockRequireScope(),
  tenantWhere: (s: { orgId: string }) => ({ orgId: s.orgId }),
  ForbiddenError: ForbiddenErrorStub,
  auditPayload: (
    scope: Record<string, unknown>,
    rest: Record<string, unknown>,
  ) => ({ ...scope, ...rest }),
}));

const leadRoute = await import("@/app/api/tenant/leads/[id]/route");

function scope(allowedPropertyIds: string[] | null) {
  return {
    userId: "u1",
    clerkUserId: "clerk_u1",
    orgId: "org-1",
    actualOrgId: "org-1",
    role: "LEASING_AGENT",
    email: "agent@client.test",
    allowedPropertyIds,
  };
}

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockRequireScope.mockReset();
});

describe("leads/[id] GET — property RBAC gate (behavioral)", () => {
  it("restricted scope constrains the query by allowed propertyIds", async () => {
    mockRequireScope.mockResolvedValue(scope(["prop-a", "prop-b"]));
    mockPrisma.lead.findFirst.mockResolvedValue(null); // record out of scope → 404

    const res = await leadRoute.GET({} as never, {
      params: Promise.resolve({ id: "lead-on-prop-c" }),
    });

    const where = mockPrisma.lead.findFirst.mock.calls[0][0].where;
    expect(where.orgId).toBe("org-1");
    expect(where.propertyId).toEqual({ in: ["prop-a", "prop-b"] });
    expect(res.status).toBe(404);
  });

  it("unrestricted scope does NOT add a property constraint", async () => {
    mockRequireScope.mockResolvedValue(scope(null));
    mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1", property: null });

    await leadRoute.GET({} as never, {
      params: Promise.resolve({ id: "lead-1" }),
    });

    const where = mockPrisma.lead.findFirst.mock.calls[0][0].where;
    expect(where.orgId).toBe("org-1");
    expect(where.propertyId).toBeUndefined();
  });
});

describe("leads/[id] PATCH — property RBAC gate (behavioral)", () => {
  it("restricted scope constrains the ownership lookup before update", async () => {
    mockRequireScope.mockResolvedValue(scope(["prop-a"]));
    mockPrisma.lead.findFirst.mockResolvedValue(null); // out of scope → 404, no update

    const req = { json: async () => ({ score: 90 }) };
    const res = await leadRoute.PATCH(req as never, {
      params: Promise.resolve({ id: "lead-on-prop-c" }),
    });

    const where = mockPrisma.lead.findFirst.mock.calls[0][0].where;
    expect(where.propertyId).toBe("prop-a"); // single allowed id → direct match
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    expect(res.status).toBe(404);
  });
});

describe("single-record endpoints — structural property-gate guard", () => {
  const ROOT = path.resolve(__dirname, "..");
  const FILES = [
    "app/api/tenant/leads/[id]/route.ts",
    "app/api/tenant/leads/[id]/notes/route.ts",
    "app/api/tenant/leads/[id]/status/route.ts",
    "app/api/tenant/visitors/[visitorId]/convert/route.ts",
    "app/api/tenant/visitors/[visitorId]/engage/route.ts",
    "app/api/tenant/conversations/[id]/handoff/route.ts",
  ];

  it("every affected endpoint still applies a property-scope fragment", () => {
    const missing: string[] = [];
    for (const rel of FILES) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf-8");
      if (
        !src.includes("propertyWhereFragment") &&
        !src.includes("propertyOrOrgLevelWhereFragment")
      ) {
        missing.push(rel);
      }
    }
    expect(
      missing,
      `These single-record endpoints lost their property-scope gate:\n${missing.join("\n")}`,
    ).toEqual([]);
  });
});
