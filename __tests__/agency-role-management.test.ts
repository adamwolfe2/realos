import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// ---------------------------------------------------------------------------
// Tests for the agency-side role rank checks added to manage-team.ts.
// Covers SECURITY_AUDIT B3: lateral / upward escalation between agency
// roles, and last-AGENCY_OWNER removal protection.
// ---------------------------------------------------------------------------

let mockPrisma: MockPrisma;
const mockRequireAgency = vi.fn();
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

class ForbiddenErrorStub extends Error {}

vi.mock("@/lib/tenancy/scope", () => ({
  requireAgency: () => mockRequireAgency(),
  requireScope: () => mockRequireAgency(),
  ForbiddenError: ForbiddenErrorStub,
  auditPayload: (
    scope: Record<string, unknown>,
    rest: Record<string, unknown>,
  ) => ({ ...scope, ...rest }),
}));

const {
  updateUserRoleAsAgency,
  removeUserFromOrgAsAgency,
} = await import("@/lib/actions/manage-team");
const { canManageAgencyRole } = await import("@/lib/agency/role-rank");
const { UserRole, OrgType } = await import("@prisma/client");

function makeScope(role: keyof typeof UserRole, userId = "agency-actor") {
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

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockRequireAgency.mockReset();
  mockClerkClient.mockReset();
  mockRevalidatePath.mockReset();
  // Default Clerk client: harmless no-ops so removal paths don't blow up.
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

describe("canManageAgencyRole helper", () => {
  it("rejects an operator promoting themselves to owner", () => {
    const result = canManageAgencyRole(
      UserRole.AGENCY_OPERATOR,
      UserRole.AGENCY_OPERATOR,
      UserRole.AGENCY_OWNER,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an admin promoting anyone to owner", () => {
    const result = canManageAgencyRole(
      UserRole.AGENCY_ADMIN,
      UserRole.AGENCY_OPERATOR,
      UserRole.AGENCY_OWNER,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/AGENCY_OWNER/);
    }
  });

  it("allows an owner to promote an admin to owner", () => {
    const result = canManageAgencyRole(
      UserRole.AGENCY_OWNER,
      UserRole.AGENCY_ADMIN,
      UserRole.AGENCY_OWNER,
    );
    expect(result.ok).toBe(true);
  });

  it("allows admin-on-admin removal (peer rank permitted for non-owner targets)", () => {
    const result = canManageAgencyRole(
      UserRole.AGENCY_ADMIN,
      UserRole.AGENCY_ADMIN,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects admin trying to remove an owner", () => {
    const result = canManageAgencyRole(
      UserRole.AGENCY_ADMIN,
      UserRole.AGENCY_OWNER,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects operator trying to remove an owner", () => {
    const result = canManageAgencyRole(
      UserRole.AGENCY_OPERATOR,
      UserRole.AGENCY_OWNER,
    );
    expect(result.ok).toBe(false);
  });

  it("allows an owner to remove an admin", () => {
    const result = canManageAgencyRole(
      UserRole.AGENCY_OWNER,
      UserRole.AGENCY_ADMIN,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects when target is not an agency user", () => {
    const result = canManageAgencyRole(
      UserRole.AGENCY_OWNER,
      UserRole.CLIENT_OWNER,
    );
    expect(result.ok).toBe(false);
  });
});

describe("updateUserRoleAsAgency rank enforcement", () => {
  it("rejects an operator trying to promote themselves to owner", async () => {
    mockRequireAgency.mockResolvedValue(makeScope("AGENCY_OPERATOR", "op-1"));
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_OPERATOR", "op-1"),
    );

    const result = await updateUserRoleAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.AGENCY_OWNER,
    });

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("allows an operator-equivalent client mgmt (operator promoting viewer to admin on client org)", async () => {
    mockRequireAgency.mockResolvedValue(makeScope("AGENCY_OPERATOR"));
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "client-user",
      orgId: "client-org",
      email: "viewer@client.test",
      role: UserRole.CLIENT_VIEWER,
      org: { orgType: OrgType.CLIENT },
    });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.auditEvent.create.mockResolvedValue({});

    const result = await updateUserRoleAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.CLIENT_ADMIN,
    });

    expect(result.ok).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });

  it("rejects an admin promoting another admin to owner", async () => {
    mockRequireAgency.mockResolvedValue(makeScope("AGENCY_ADMIN", "admin-1"));
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_ADMIN", "admin-2"),
    );

    const result = await updateUserRoleAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.AGENCY_OWNER,
    });

    expect(result.ok).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects demoting the last AGENCY_OWNER", async () => {
    mockRequireAgency.mockResolvedValue(makeScope("AGENCY_OWNER", "owner-1"));
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_OWNER", "owner-2"),
    );
    mockPrisma.user.count.mockResolvedValue(1);

    const result = await updateUserRoleAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
      role: UserRole.AGENCY_ADMIN,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/last remaining AGENCY_OWNER/),
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe("removeUserFromOrgAsAgency rank enforcement", () => {
  it("rejects an operator removing an owner", async () => {
    mockRequireAgency.mockResolvedValue(makeScope("AGENCY_OPERATOR", "op-1"));
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_OWNER", "owner-1"),
    );

    const result = await removeUserFromOrgAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result.ok).toBe(false);
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it("rejects an admin removing an owner (owner-only privilege)", async () => {
    mockRequireAgency.mockResolvedValue(makeScope("AGENCY_ADMIN", "admin-1"));
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_OWNER", "owner-1"),
    );

    const result = await removeUserFromOrgAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/AGENCY_OWNER/),
    });
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it("rejects an owner removing themselves", async () => {
    mockRequireAgency.mockResolvedValue(makeScope("AGENCY_OWNER", "owner-1"));
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_OWNER", "owner-1"),
    );

    const result = await removeUserFromOrgAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/yourself/i),
    });
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it("rejects an owner removing the only remaining owner (other id, count=1)", async () => {
    mockRequireAgency.mockResolvedValue(makeScope("AGENCY_OWNER", "owner-1"));
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_OWNER", "owner-2"),
    );
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.organization.findUnique.mockResolvedValue({
      clerkOrgId: "org_x",
      orgType: OrgType.AGENCY,
    });

    const result = await removeUserFromOrgAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/last remaining AGENCY_OWNER/),
    });
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it("allows an owner removing one of two owners", async () => {
    mockRequireAgency.mockResolvedValue(makeScope("AGENCY_OWNER", "owner-1"));
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_OWNER", "owner-2"),
    );
    mockPrisma.user.count.mockResolvedValue(2);
    mockPrisma.organization.findUnique.mockResolvedValue({
      clerkOrgId: "org_x",
      orgType: OrgType.AGENCY,
    });
    mockPrisma.user.delete.mockResolvedValue({});
    mockPrisma.auditEvent.create.mockResolvedValue({});

    const result = await removeUserFromOrgAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result.ok).toBe(true);
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: "owner-2" },
    });
  });

  it("allows an owner removing an admin", async () => {
    mockRequireAgency.mockResolvedValue(makeScope("AGENCY_OWNER", "owner-1"));
    mockPrisma.user.findUnique.mockResolvedValue(
      makeAgencyUser("AGENCY_ADMIN", "admin-2"),
    );
    mockPrisma.organization.findUnique.mockResolvedValue({
      clerkOrgId: "org_x",
      orgType: OrgType.AGENCY,
    });
    mockPrisma.user.delete.mockResolvedValue({});
    mockPrisma.auditEvent.create.mockResolvedValue({});

    const result = await removeUserFromOrgAsAgency({
      userId: "ckxxxxxxxxxxxxxxxxxxxxxxx",
    });

    expect(result.ok).toBe(true);
    expect(mockPrisma.user.delete).toHaveBeenCalled();
  });
});
