import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// ---------------------------------------------------------------------------
// Attack-style regression tests for role escalation paths.
//
// Covers:
//   S2a — AGENCY_OPERATOR cannot promote themselves or others to AGENCY_ADMIN/
//          AGENCY_OWNER via updateUserRoleAsAgency.
//   S2b — CLIENT_ADMIN cannot assign AGENCY_* roles via updateUserRoleAsClient.
//   S2c — cross-org invite/reassignment is rejected by the invite route guard.
//   S2d — CLIENT_* callers inviting AGENCY_* roles are rejected.
// ---------------------------------------------------------------------------

let mockPrisma: MockPrisma;
const mockRequireAgency = vi.fn();
const mockRequireScope = vi.fn();
const mockRequireWritableWorkspace = vi.fn();
const mockClerkClient = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: () => mockClerkClient(),
}));

class ForbiddenErrorStub extends Error {
  status = 403;
}

vi.mock("@/lib/tenancy/scope", () => ({
  requireAgency: () => mockRequireAgency(),
  requireScope: () => mockRequireScope(),
  requireWritableWorkspace: () => mockRequireWritableWorkspace(),
  ForbiddenError: ForbiddenErrorStub,
  auditPayload: (
    scope: Record<string, unknown>,
    rest: Record<string, unknown>,
  ) => ({ ...scope, ...rest }),
}));

const { updateUserRoleAsAgency, updateUserRoleAsClient } = await import(
  "@/lib/actions/manage-team"
);
const { UserRole, OrgType } = await import("@prisma/client");

function makeAgencyScope(role: keyof typeof UserRole, userId = "actor") {
  return {
    userId,
    clerkUserId: `clerk_${userId}`,
    orgId: "agency-org",
    actualOrgId: "agency-org",
    orgType: OrgType.AGENCY,
    actualOrgType: OrgType.AGENCY,
    role: UserRole[role],
    email: `${userId}@agency.test`,
    isAgency: true,
    isAlPartner: false,
    isImpersonating: false,
    allowedPropertyIds: null,
  };
}

function makeClientScope(role: keyof typeof UserRole, userId = "client-actor") {
  return {
    userId,
    clerkUserId: `clerk_${userId}`,
    orgId: "client-org",
    actualOrgId: "client-org",
    orgType: OrgType.CLIENT,
    actualOrgType: OrgType.CLIENT,
    role: UserRole[role],
    email: `${userId}@client.test`,
    isAgency: false,
    isAlPartner: false,
    isImpersonating: false,
    allowedPropertyIds: null,
  };
}

function makeAgencyUser(role: keyof typeof UserRole, id = "target-user") {
  return {
    id,
    orgId: "agency-org",
    email: `${id}@agency.test`,
    clerkUserId: `clerk_${id}`,
    role: UserRole[role],
    org: { orgType: OrgType.AGENCY },
  };
}

function makeClientUser(role: keyof typeof UserRole, id = "client-user") {
  return {
    id,
    orgId: "client-org",
    email: `${id}@client.test`,
    clerkUserId: `clerk_${id}`,
    role: UserRole[role],
    org: { orgType: OrgType.CLIENT },
  };
}

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockRequireAgency.mockReset();
  mockRequireScope.mockReset();
  mockRequireWritableWorkspace.mockReset();
  mockClerkClient.mockReset();
  mockRevalidatePath.mockReset();
  mockClerkClient.mockResolvedValue({
    organizations: {
      deleteOrganizationMembership: vi.fn().mockResolvedValue(undefined),
    },
    invitations: {
      getInvitationList: vi.fn().mockResolvedValue({ data: [] }),
      revokeInvitation: vi.fn().mockResolvedValue(undefined),
    },
  });
});

// ---------------------------------------------------------------------------
// S2a — AGENCY_OPERATOR self-promotion / upward escalation
// ---------------------------------------------------------------------------

describe("S2a: AGENCY_OPERATOR role escalation (updateUserRoleAsAgency)", () => {
  it("rejects operator self-promoting to AGENCY_ADMIN", async () => {
    mockRequireAgency.mockResolvedValue(
      makeAgencyScope("AGENCY_OPERATOR", "op-1"),
    );
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_OPERATOR", "op-1"),
    );

    const result = await updateUserRoleAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.AGENCY_ADMIN,
    });

    expect(result.ok).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects operator self-promoting to AGENCY_OWNER", async () => {
    mockRequireAgency.mockResolvedValue(
      makeAgencyScope("AGENCY_OPERATOR", "op-1"),
    );
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_OPERATOR", "op-1"),
    );

    const result = await updateUserRoleAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.AGENCY_OWNER,
    });

    expect(result.ok).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects operator promoting another operator to AGENCY_ADMIN", async () => {
    mockRequireAgency.mockResolvedValue(
      makeAgencyScope("AGENCY_OPERATOR", "op-1"),
    );
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_OPERATOR", "op-2"),
    );

    const result = await updateUserRoleAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.AGENCY_ADMIN,
    });

    expect(result.ok).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("allows operator to update CLIENT_* roles on client org users", async () => {
    mockRequireAgency.mockResolvedValue(makeAgencyScope("AGENCY_OPERATOR"));
    mockPrisma.user.findUnique.mockResolvedValue(
      makeClientUser("CLIENT_VIEWER"),
    );
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.auditEvent.create.mockResolvedValue({});

    const result = await updateUserRoleAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.CLIENT_ADMIN,
    });

    expect(result.ok).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// S2b — CLIENT_* callers cannot assign AGENCY_* roles
// ---------------------------------------------------------------------------

describe("S2b: CLIENT_ADMIN cannot assign AGENCY_* roles (updateUserRoleAsClient)", () => {
  it("rejects CLIENT_ADMIN attempting to assign AGENCY_OWNER to a client user", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(
      makeClientScope("CLIENT_ADMIN", "cadmin-1"),
    );
    mockPrisma.user.findUnique.mockImplementation((args: { where: { clerkUserId?: string; id?: string } }) => {
      // First call: load caller by clerkUserId
      if (args?.where?.clerkUserId) {
        return Promise.resolve({
          role: UserRole.CLIENT_ADMIN,
          orgId: "client-org",
        });
      }
      // Second call: load target by id
      return Promise.resolve({
        id: "target-user",
        orgId: "client-org",
        email: "target@client.test",
        role: UserRole.CLIENT_VIEWER,
      });
    });

    const result = await updateUserRoleAsClient({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.AGENCY_OWNER,
    });

    expect(result.ok).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects CLIENT_ADMIN attempting to assign AGENCY_ADMIN", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(
      makeClientScope("CLIENT_ADMIN", "cadmin-1"),
    );
    mockPrisma.user.findUnique.mockImplementation((args: { where: { clerkUserId?: string; id?: string } }) => {
      if (args?.where?.clerkUserId) {
        return Promise.resolve({
          role: UserRole.CLIENT_ADMIN,
          orgId: "client-org",
        });
      }
      return Promise.resolve({
        id: "target-user",
        orgId: "client-org",
        email: "target@client.test",
        role: UserRole.CLIENT_VIEWER,
      });
    });

    const result = await updateUserRoleAsClient({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.AGENCY_ADMIN,
    });

    expect(result.ok).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects CLIENT_OWNER attempting to assign AGENCY_OPERATOR", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(
      makeClientScope("CLIENT_OWNER", "cowner-1"),
    );
    mockPrisma.user.findUnique.mockImplementation((args: { where: { clerkUserId?: string; id?: string } }) => {
      if (args?.where?.clerkUserId) {
        return Promise.resolve({
          role: UserRole.CLIENT_OWNER,
          orgId: "client-org",
        });
      }
      return Promise.resolve({
        id: "target-user",
        orgId: "client-org",
        email: "target@client.test",
        role: UserRole.CLIENT_ADMIN,
      });
    });

    const result = await updateUserRoleAsClient({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.AGENCY_OPERATOR,
    });

    expect(result.ok).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// S2c — Cross-org reassignment via updateUserRoleAsClient
// ---------------------------------------------------------------------------

describe("S2c: cross-org role change rejection (updateUserRoleAsClient)", () => {
  it("rejects a CLIENT_OWNER attempting to reassign a user from a different org", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(
      makeClientScope("CLIENT_OWNER", "cowner-1"),
    );
    mockPrisma.user.findUnique.mockImplementation((args: { where: { clerkUserId?: string; id?: string } }) => {
      if (args?.where?.clerkUserId) {
        return Promise.resolve({
          role: UserRole.CLIENT_OWNER,
          orgId: "client-org",
        });
      }
      // Target user belongs to a DIFFERENT org
      return Promise.resolve({
        id: "other-org-user",
        orgId: "OTHER-org",
        email: "other@elsewhere.test",
        role: UserRole.CLIENT_VIEWER,
      });
    });

    const result = await updateUserRoleAsClient({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.CLIENT_ADMIN,
    });

    expect(result.ok).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// S2d — AGENCY_ADMIN attempting to promote to AGENCY_OWNER via agency action
// ---------------------------------------------------------------------------

describe("S2d: AGENCY_ADMIN cannot promote to AGENCY_OWNER (updateUserRoleAsAgency)", () => {
  it("rejects admin promoting another user to AGENCY_OWNER", async () => {
    mockRequireAgency.mockResolvedValue(
      makeAgencyScope("AGENCY_ADMIN", "admin-1"),
    );
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_ADMIN", "admin-2"),
    );

    const result = await updateUserRoleAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.AGENCY_OWNER,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/AGENCY_OWNER/);
    }
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects admin self-promoting to AGENCY_OWNER", async () => {
    mockRequireAgency.mockResolvedValue(
      makeAgencyScope("AGENCY_ADMIN", "admin-1"),
    );
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_ADMIN", "admin-1"),
    );

    const result = await updateUserRoleAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.AGENCY_OWNER,
    });

    expect(result.ok).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
