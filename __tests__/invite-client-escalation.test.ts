import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// F-001: a client caller can't escalate through the invite route. CLIENT_ADMIN
// can't invite an Owner; a property-restricted admin can only grant buildings
// they hold (and can't invite with an empty list = org-wide).

let mockPrisma: MockPrisma;
const mockRequireWorkspaceAdmin = vi.fn();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

class ForbiddenErrorStub extends Error {
  status = 403;
}

vi.mock("@/lib/tenancy/scope", () => ({
  requireWorkspaceAdmin: () => mockRequireWorkspaceAdmin(),
  ForbiddenError: ForbiddenErrorStub,
  auditPayload: (s: Record<string, unknown>, r: Record<string, unknown>) => ({
    ...s,
    ...r,
  }),
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: () =>
    Promise.resolve({
      invitations: {
        createInvitation: vi.fn().mockResolvedValue({ url: "https://x.test" }),
      },
    }),
}));
vi.mock("@/lib/email/onboarding-emails", () => ({
  sendTeammateInviteEmail: vi.fn().mockResolvedValue({ ok: true }),
}));

const { POST } = await import("@/app/api/admin/clients/invite/route");
const { UserRole, OrgType } = await import("@prisma/client");

function req(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/clients/invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ organizationId: "org-1", email: "new@t.test", ...body }),
  });
}

function seedCaller(
  role: (typeof UserRole)[keyof typeof UserRole],
  allowedPropertyIds: string[] | null,
  existing: Record<string, unknown> | null = null,
  isAgency = false,
) {
  mockRequireWorkspaceAdmin.mockResolvedValue({
    userId: "u1",
    clerkUserId: "clerk_u1",
    orgId: "org-1",
    role,
    isAgency,
    isImpersonating: false,
    allowedPropertyIds,
  });
  mockPrisma.user.findUnique.mockImplementation(
    (args: { where?: { clerkUserId?: string } }) =>
      Promise.resolve(
        args?.where?.clerkUserId === "clerk_u1"
          ? { role, orgId: "org-1", firstName: "A", lastName: "B", email: "a@t.test" }
          : existing,
      ),
  );
}

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockPrisma.organization.findUnique.mockResolvedValue({
    id: "org-1",
    name: "Org",
    orgType: OrgType.CLIENT,
  });
  mockPrisma.property.findMany.mockImplementation(
    (args: { where: { id: { in: string[] } } }) =>
      Promise.resolve(args.where.id.in.map((id) => ({ id }))),
  );
});

describe("invite route client escalation guards (F-001)", () => {
  it("CLIENT_ADMIN inviting an Owner gets 403", async () => {
    seedCaller(UserRole.CLIENT_ADMIN, null);
    const res = await POST(req({ role: "CLIENT_OWNER" }));
    expect(res.status).toBe(403);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("restricted admin inviting outside their grant gets 403", async () => {
    seedCaller(UserRole.CLIENT_ADMIN, ["p1"]);
    const res = await POST(req({ role: "LEASING_AGENT", propertyIds: ["p1", "p2"] }));
    expect(res.status).toBe(403);
  });

  it("restricted admin inviting an org-wide admin (no propertyIds) gets 403", async () => {
    seedCaller(UserRole.CLIENT_ADMIN, ["p1"]);
    const res = await POST(req({ role: "CLIENT_ADMIN" }));
    expect(res.status).toBe(403);
  });

  it("restricted admin can invite within their grant", async () => {
    seedCaller(UserRole.CLIENT_ADMIN, ["p1"]);
    const res = await POST(req({ role: "LEASING_AGENT", propertyIds: ["p1"] }));
    expect(res.status).toBe(200);
  });

  it("re-invite of a claimed same-org user is a 409, never a role rewrite", async () => {
    seedCaller(UserRole.CLIENT_ADMIN, null, {
      id: "owner-1",
      clerkUserId: "user_real",
      orgId: "org-1",
      role: UserRole.CLIENT_OWNER,
    });
    const res = await POST(req({ role: "CLIENT_VIEWER", propertyIds: ["p1"] }));
    expect(res.status).toBe(409);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("CLIENT_ADMIN can't change a pending Owner seed", async () => {
    seedCaller(UserRole.CLIENT_ADMIN, null, {
      id: "seed-1",
      clerkUserId: "seed_pending_new@t.test",
      orgId: "org-1",
      role: UserRole.CLIENT_OWNER,
    });
    const res = await POST(req({ role: "CLIENT_ADMIN" }));
    expect(res.status).toBe(403);
  });

  it("re-inviting the last pending Owner as a lower role is refused", async () => {
    seedCaller(UserRole.CLIENT_OWNER, null, {
      id: "seed-1",
      clerkUserId: "seed_pending_new@t.test",
      orgId: "org-1",
      role: UserRole.CLIENT_OWNER,
    });
    mockPrisma.user.count.mockResolvedValue(1);
    const res = await POST(req({ role: "CLIENT_ADMIN" }));
    expect(res.status).toBe(409);
  });

  it("pending same-org seed can still be re-invited (resend)", async () => {
    seedCaller(UserRole.CLIENT_ADMIN, null, {
      id: "seed-2",
      clerkUserId: "seed_pending_new@t.test",
      orgId: "org-1",
      role: UserRole.CLIENT_ADMIN,
    });
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: MockPrisma) => Promise<string>) => fn(mockPrisma),
    );
    mockPrisma.user.update.mockResolvedValue({ id: "seed-2" });
    mockPrisma.userPropertyAccess = {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    } as unknown as MockPrisma["userPropertyAccess"];
    const res = await POST(req({ role: "CLIENT_ADMIN" }));
    expect(res.status).toBe(200);
  });

  it("client-org user holding an AGENCY_* role is not treated as agency", async () => {
    // isAgency false (CLIENT org), role AGENCY_OPERATOR: falls into the
    // client branch, which only allows CLIENT_OWNER / CLIENT_ADMIN callers.
    seedCaller(UserRole.AGENCY_OPERATOR, null, null, false);
    const res = await POST(req({ role: "CLIENT_ADMIN" }));
    expect(res.status).toBe(403);
  });

  it.each(["SALES_REP"])("agency can't invite %s into a client org", async (r) => {
    seedCaller(UserRole.AGENCY_ADMIN, null, null, true);
    const res = await POST(req({ role: r }));
    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
