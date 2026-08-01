import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Coverage gap: app/api/tenant/reputation-mentions/{route,[id]/route}.ts had
// zero test coverage despite carrying the exact bug class other property-
// scope tests guard elsewhere (P1-2 per their own comments: a property-
// restricted user could read/flag mentions on properties outside their
// grant). Locks in the current — already-correct — property-scope gates
// on both GET (list) and PATCH (review/flag) against regression.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  allowed: true,
  property: null as Record<string, unknown> | null,
  mention: null as Record<string, unknown> | null,
  db: {
    property: { findFirst: vi.fn() },
    propertyMention: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/rate-limit", () => ({
  clientReadLimiter: null,
  clientWriteLimiter: null,
  checkRateLimit: vi.fn(async () => ({ allowed: h.allowed })),
  rateLimited: () => new Response(JSON.stringify({ error: "rate limited" }), { status: 429 }),
}));

const RESTRICTED_SCOPE = {
  userId: "user_1",
  orgId: "org_1",
  isAgency: false,
  allowedPropertyIds: ["prop_allowed"],
};
const UNRESTRICTED_SCOPE = {
  userId: "user_1",
  orgId: "org_1",
  isAgency: false,
  allowedPropertyIds: null,
};

const mockRequireScope = vi.fn();
const mockRequireWritableWorkspace = vi.fn();
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>(
    "@/lib/tenancy/scope",
  );
  return {
    ...actual,
    requireScope: () => mockRequireScope(),
    requireWritableWorkspace: () => mockRequireWritableWorkspace(),
  };
});

const { GET } = await import("@/app/api/tenant/reputation-mentions/route");
const { PATCH } = await import("@/app/api/tenant/reputation-mentions/[id]/route");

beforeEach(() => {
  vi.clearAllMocks();
  h.allowed = true;
  h.property = { id: "prop_allowed" };
  h.mention = { id: "mention_1", propertyId: "prop_allowed" };
  h.db.property.findFirst.mockImplementation(async () => h.property);
  h.db.propertyMention.findFirst.mockImplementation(async () => h.mention);
  h.db.propertyMention.findMany.mockResolvedValue([]);
  h.db.propertyMention.update.mockResolvedValue({
    id: "mention_1",
    reviewedByUserId: "user_1",
    flagged: false,
  });
  mockRequireScope.mockResolvedValue(UNRESTRICTED_SCOPE);
  mockRequireWritableWorkspace.mockResolvedValue(UNRESTRICTED_SCOPE);
});

describe("GET /api/tenant/reputation-mentions — property scope", () => {
  it("404s (not 403) when a property-restricted user requests a property outside their grant", async () => {
    mockRequireScope.mockResolvedValue(RESTRICTED_SCOPE);
    const req = new NextRequest(
      "http://localhost/api/tenant/reputation-mentions?propertyId=prop_other",
    );
    const res = (await GET(req)) as Response;
    expect(res.status).toBe(404);
    // Never even queries mentions for a property outside the grant.
    expect(h.db.propertyMention.findMany).not.toHaveBeenCalled();
  });

  it("allows a restricted user to read mentions for a property inside their grant", async () => {
    mockRequireScope.mockResolvedValue(RESTRICTED_SCOPE);
    const req = new NextRequest(
      "http://localhost/api/tenant/reputation-mentions?propertyId=prop_allowed",
    );
    const res = (await GET(req)) as Response;
    expect(res.status).toBe(200);
  });

  it("404s when the property doesn't belong to the org at all", async () => {
    h.property = null;
    const req = new NextRequest(
      "http://localhost/api/tenant/reputation-mentions?propertyId=prop_foreign_org",
    );
    const res = (await GET(req)) as Response;
    expect(res.status).toBe(404);
  });

  it("validates the query — propertyId is required", async () => {
    const req = new NextRequest("http://localhost/api/tenant/reputation-mentions");
    const res = (await GET(req)) as Response;
    expect(res.status).toBe(400);
  });

  it("rate-limits before hitting the DB", async () => {
    h.allowed = false;
    const req = new NextRequest(
      "http://localhost/api/tenant/reputation-mentions?propertyId=prop_allowed",
    );
    const res = (await GET(req)) as Response;
    expect(res.status).toBe(429);
    expect(h.db.property.findFirst).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/tenant/reputation-mentions/[id] — property scope", () => {
  function patchReq(body: unknown) {
    return new NextRequest("http://localhost/api/tenant/reputation-mentions/mention_1", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  it("404s when the mention belongs to a property outside the restricted user's grant", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(RESTRICTED_SCOPE);
    h.mention = { id: "mention_1", propertyId: "prop_other" };
    const res = (await PATCH(patchReq({ flagged: true }), {
      params: Promise.resolve({ id: "mention_1" }),
    })) as Response;
    expect(res.status).toBe(404);
    expect(h.db.propertyMention.update).not.toHaveBeenCalled();
  });

  it("allows a restricted user to flag a mention on a property inside their grant", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(RESTRICTED_SCOPE);
    h.mention = { id: "mention_1", propertyId: "prop_allowed" };
    const res = (await PATCH(patchReq({ flagged: true }), {
      params: Promise.resolve({ id: "mention_1" }),
    })) as Response;
    expect(res.status).toBe(200);
    expect(h.db.propertyMention.update).toHaveBeenCalled();
  });

  it("404s when the mention doesn't exist in this org at all", async () => {
    h.mention = null;
    const res = (await PATCH(patchReq({ flagged: true }), {
      params: Promise.resolve({ id: "mention_missing" }),
    })) as Response;
    expect(res.status).toBe(404);
  });

  it("rejects a body with neither reviewed nor flagged set", async () => {
    const res = (await PATCH(patchReq({}), {
      params: Promise.resolve({ id: "mention_1" }),
    })) as Response;
    expect(res.status).toBe(400);
  });
});
