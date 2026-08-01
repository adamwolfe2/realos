import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Coverage gap: app/api/tenant/creative-requests/route.ts (GET + POST) had
// zero test coverage despite POST carrying the property-scope gate (per its
// own "review 2026-07-31" comment) other property-scope tests guard
// elsewhere. Covers: auth on both verbs, validation, the property-in-scope
// 403 for a restricted user requesting outside their grant, the
// cross-tenant-property 403, and the success path scoped to scope.orgId.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: {
    creativeRequest: { findMany: vi.fn(), create: vi.fn() },
    property: { findFirst: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/integrations/slack", () => ({
  notifyNewIntake: vi.fn(async () => ({ ok: true })),
}));

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

import { GET, POST } from "@/app/api/tenant/creative-requests/route";
import { ForbiddenError } from "@/lib/tenancy/scope";

const UNRESTRICTED_SCOPE = {
  orgId: "org_1",
  userId: "user_1",
  email: "ops@example.com",
  allowedPropertyIds: null,
};
const RESTRICTED_SCOPE = { ...UNRESTRICTED_SCOPE, allowedPropertyIds: ["prop_allowed"] };

const VALID_BODY = {
  title: "New leasing flyer",
  description: "Need a flyer for the fall push",
  format: "PRINT_FLYER",
};

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/tenant/creative-requests", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireScope.mockResolvedValue(UNRESTRICTED_SCOPE);
  mockRequireWritableWorkspace.mockResolvedValue(UNRESTRICTED_SCOPE);
  h.db.creativeRequest.findMany.mockResolvedValue([]);
  h.db.creativeRequest.create.mockResolvedValue({ id: "cr_1", title: VALID_BODY.title });
  h.db.property.findFirst.mockResolvedValue({ id: "prop_allowed" });
  h.db.auditEvent.create.mockResolvedValue({});
});

describe("GET /api/tenant/creative-requests", () => {
  it("requires auth", async () => {
    mockRequireScope.mockRejectedValue(new ForbiddenError("Not authenticated"));
    const res = (await GET(
      new NextRequest("http://localhost/api/tenant/creative-requests"),
    )) as Response;
    expect(res.status).toBe(403);
  });

  it("returns the org's creative requests", async () => {
    const res = (await GET(
      new NextRequest("http://localhost/api/tenant/creative-requests"),
    )) as Response;
    expect(res.status).toBe(200);
    expect(h.db.creativeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: "org_1" }) }),
    );
  });
});

describe("POST /api/tenant/creative-requests", () => {
  it("requires a writable workspace (trial-gate aware)", async () => {
    mockRequireWritableWorkspace.mockRejectedValue(new ForbiddenError("Trial expired"));
    const res = (await POST(postReq(VALID_BODY))) as Response;
    expect(res.status).toBe(403);
  });

  it("rejects an invalid body", async () => {
    const res = (await POST(postReq({ title: "x" }))) as Response;
    expect(res.status).toBe(400);
  });

  it("403s a property-restricted user requesting a property outside their grant", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(RESTRICTED_SCOPE);
    const res = (await POST(
      postReq({ ...VALID_BODY, propertyId: "prop_outside_grant" }),
    )) as Response;
    expect(res.status).toBe(403);
    expect(h.db.creativeRequest.create).not.toHaveBeenCalled();
    // Never even reaches the ownership DB check — propertyInScope fails first.
    expect(h.db.property.findFirst).not.toHaveBeenCalled();
  });

  it("403s a propertyId that belongs to another tenant entirely", async () => {
    h.db.property.findFirst.mockResolvedValue(null);
    const res = (await POST(postReq({ ...VALID_BODY, propertyId: "prop_foreign" }))) as Response;
    expect(res.status).toBe(403);
    expect(h.db.creativeRequest.create).not.toHaveBeenCalled();
  });

  it("allows a restricted user to submit for a property inside their grant", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(RESTRICTED_SCOPE);
    const res = (await POST(postReq({ ...VALID_BODY, propertyId: "prop_allowed" }))) as Response;
    expect(res.status).toBe(201);
  });

  it("creates the request scoped to scope.orgId and returns 201", async () => {
    const res = (await POST(postReq(VALID_BODY))) as Response;
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ id: "cr_1" });
    expect(h.db.creativeRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: "org_1",
          requestedByUserId: "user_1",
          status: "SUBMITTED",
        }),
      }),
    );
  });
});
