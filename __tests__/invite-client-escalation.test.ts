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
) {
  mockRequireWorkspaceAdmin.mockResolvedValue({
    userId: "u1",
    clerkUserId: "clerk_u1",
    orgId: "org-1",
    role,
    isAgency: false,
    isImpersonating: false,
    allowedPropertyIds,
  });
  mockPrisma.user.findUnique.mockImplementation(
    (args: { where?: { clerkUserId?: string } }) =>
      Promise.resolve(
        args?.where?.clerkUserId === "clerk_u1"
          ? { role, orgId: "org-1", firstName: "A", lastName: "B", email: "a@t.test" }
          : null,
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
});
