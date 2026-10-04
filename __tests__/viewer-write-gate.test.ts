import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrgType, ProductLine, UserRole } from "@prisma/client";

// F-010: requireWritableWorkspace must reject read-only seats (CLIENT_VIEWER,
// AL_PARTNER) so every mutation path inherits the gate. Exercises the REAL
// scope.ts against mocked Clerk + prisma.

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
  leadDeleteMany: vi.fn(),
  orgFindUnique: vi.fn(),
  tenantIntegrationUpsert: vi.fn(),
}));

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mocks.auth(),
  clerkClient: () =>
    Promise.resolve({
      users: { getUser: vi.fn().mockResolvedValue({ publicMetadata: {} }) },
    }),
  currentUser: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/billing/trial-status", () => ({
  isWorkspaceReadOnly: () => false,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => mocks.userFindUnique(...a) },
    userPropertyAccess: { findMany: vi.fn().mockResolvedValue([]) },
    organization: { findUnique: (...a: unknown[]) => mocks.orgFindUnique(...a) },
    lead: { deleteMany: (...a: unknown[]) => mocks.leadDeleteMany(...a) },
    auditEvent: { create: vi.fn() },
    tenantIntegration: {
      upsert: (...a: unknown[]) => mocks.tenantIntegrationUpsert(...a),
    },
  },
}));

const { bulkDeleteLeads } = await import("@/lib/actions/lead-bulk");
const { PATCH: appfolioPatch } = await import("@/app/api/tenant/appfolio/route");
const { requireWritableWorkspace } = await import("@/lib/tenancy/scope");

function seed(role: UserRole, orgType: OrgType = OrgType.CLIENT) {
  mocks.userFindUnique.mockResolvedValue({
    id: "u1",
    clerkUserId: "clerk_u1",
    orgId: "org-1",
    role,
    email: "x@test.dev",
    org: { id: "org-1", orgType, productLine: ProductLine.STUDENT_HOUSING },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    userId: "clerk_u1",
    sessionClaims: { sid: "s1", publicMetadata: {} },
  });
  mocks.orgFindUnique.mockResolvedValue({
    subscriptionStatus: "ACTIVE",
    trialStartedAt: null,
    trialEndsAt: null,
  });
  mocks.leadDeleteMany.mockResolvedValue({ count: 0 });
});

describe("viewer write gate (F-010)", () => {
  it("viewer cannot bulk-delete leads", async () => {
    seed(UserRole.CLIENT_VIEWER);
    const res = await bulkDeleteLeads({ leadIds: ["lead-1"] });
    expect(res.ok).toBe(false);
    expect(mocks.leadDeleteMany).not.toHaveBeenCalled();
  });

  it("viewer gets 403 on AppFolio PATCH", async () => {
    seed(UserRole.CLIENT_VIEWER);
    const req = new NextRequest("http://localhost/api/tenant/appfolio", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ instanceSubdomain: "acme" }),
    });
    const res = await appfolioPatch(req);
    expect(res.status).toBe(403);
    expect(mocks.tenantIntegrationUpsert).not.toHaveBeenCalled();
  });

  it("leasing agent (write seat) can still bulk-delete", async () => {
    seed(UserRole.LEASING_AGENT);
    const res = await bulkDeleteLeads({ leadIds: ["lead-1"] });
    expect(res.ok).toBe(true);
    expect(mocks.leadDeleteMany).toHaveBeenCalled();
  });

  it("AL_PARTNER is read-only", async () => {
    seed(UserRole.AL_PARTNER, OrgType.AGENCY);
    await expect(requireWritableWorkspace()).rejects.toMatchObject({
      status: 403,
    });
  });
});
