import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Per-property users (org with properties A, B, C).
//
// Zero UserPropertyAccess rows means UNRESTRICTED in scope.ts. These tests pin
// the write-path guards that keep a restricted teammate from silently
// becoming org-wide, and keep a property-restricted admin inside their own
// properties:
//   1. Role change to LEASING_AGENT / CLIENT_VIEWER on a teammate with zero
//      grants is refused (it would be a scoped role with org-wide access).
//   2. An admin restricted to B cannot change the role of, or remove, a
//      teammate on A or an unrestricted teammate.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(async () => ({})),
      delete: vi.fn(() => ({})),
      count: vi.fn(async () => 2),
    },
    userPropertyAccess: {
      findMany: vi.fn(async (_a?: any): Promise<any> => []),
      count: vi.fn(async (_a?: any): Promise<number> => 0),
    },
    organization: { findUnique: vi.fn(async () => ({ clerkOrgId: null, orgType: "CLIENT" })) },
    auditEvent: { create: vi.fn(() => ({})) },
    $transaction: vi.fn(async (ops: unknown) => ops),
  },
  scope: vi.fn(),
  agency: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    organizations: { deleteOrganizationMembership: vi.fn(async () => ({})) },
    invitations: {
      getInvitationList: vi.fn(async () => ({ data: [] })),
      revokeInvitation: vi.fn(async () => ({})),
    },
  }),
}));
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>(
    "@/lib/tenancy/scope",
  );
  return {
    ...actual,
    requireWritableWorkspace: () => h.scope(),
    requireAgency: () => h.agency(),
  };
});

const {
  updateUserRoleAsClient,
  updateUserRoleAsAgency,
  removeUserFromOrgAsClient,
} = await import("@/lib/actions/manage-team");

const TARGET = "ckxxxxxxxxxxxxxxxxxxxxxxx";

function clientScope(allowedPropertyIds: string[] | null) {
  return {
    userId: "caller",
    clerkUserId: "clerk_caller",
    orgId: "org-1",
    actualOrgId: "org-1",
    role: "CLIENT_ADMIN",
    isAgency: false,
    allowedPropertyIds,
  };
}

function wireUsers(targetRole: string) {
  h.db.user.findUnique.mockImplementation(
    async (args: { where: { clerkUserId?: string } }) =>
      args.where.clerkUserId
        ? { id: "caller", role: "CLIENT_ADMIN", orgId: "org-1" }
        : {
            id: TARGET,
            orgId: "org-1",
            email: "t@client.test",
            role: targetRole,
            clerkUserId: "seed_pending_t@client.test",
            org: { orgType: "CLIENT" },
          },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.db.userPropertyAccess.findMany.mockResolvedValue([]);
  h.db.userPropertyAccess.count.mockResolvedValue(0);
});

describe("role change cannot create a scoped role with zero grants", () => {
  it("client admin: CLIENT_ADMIN (no grants) -> LEASING_AGENT is refused", async () => {
    h.scope.mockResolvedValue(clientScope(null));
    wireUsers("CLIENT_ADMIN");
    const r = await updateUserRoleAsClient({ userId: TARGET, role: "LEASING_AGENT" as never });
    expect(r.ok).toBe(false);
    expect(h.db.user.update).not.toHaveBeenCalled();
  });

  it("client admin: allowed once the teammate holds a grant", async () => {
    h.scope.mockResolvedValue(clientScope(null));
    wireUsers("CLIENT_ADMIN");
    h.db.userPropertyAccess.count.mockResolvedValue(1);
    const r = await updateUserRoleAsClient({ userId: TARGET, role: "CLIENT_VIEWER" as never });
    expect(r.ok).toBe(true);
  });

  it("agency: CLIENT_ADMIN (no grants) -> CLIENT_VIEWER is refused", async () => {
    h.agency.mockResolvedValue({ ...clientScope(null), role: "AGENCY_OWNER", isAgency: true });
    wireUsers("CLIENT_ADMIN");
    const r = await updateUserRoleAsAgency({ userId: TARGET, role: "CLIENT_VIEWER" as never });
    expect(r.ok).toBe(false);
    expect(h.db.user.update).not.toHaveBeenCalled();
  });
});

describe("admin restricted to prop-b stays inside prop-b", () => {
  it("cannot change the role of a teammate on prop-a", async () => {
    h.scope.mockResolvedValue(clientScope(["prop-b"]));
    wireUsers("LEASING_AGENT");
    h.db.userPropertyAccess.findMany.mockResolvedValue([{ propertyId: "prop-a" }]);
    const r = await updateUserRoleAsClient({ userId: TARGET, role: "CLIENT_VIEWER" as never });
    expect(r.ok).toBe(false);
    expect(h.db.user.update).not.toHaveBeenCalled();
  });

  it("cannot change the role of an unrestricted teammate", async () => {
    h.scope.mockResolvedValue(clientScope(["prop-b"]));
    wireUsers("CLIENT_ADMIN");
    const r = await updateUserRoleAsClient({ userId: TARGET, role: "CLIENT_ADMIN" as never });
    expect(r.ok).toBe(false);
  });

  it("can change the role of a teammate on prop-b only", async () => {
    h.scope.mockResolvedValue(clientScope(["prop-b"]));
    wireUsers("LEASING_AGENT");
    h.db.userPropertyAccess.findMany.mockResolvedValue([{ propertyId: "prop-b" }]);
    h.db.userPropertyAccess.count.mockResolvedValue(1);
    const r = await updateUserRoleAsClient({ userId: TARGET, role: "CLIENT_VIEWER" as never });
    expect(r.ok).toBe(true);
  });

  it("cannot remove a teammate on prop-a", async () => {
    h.scope.mockResolvedValue(clientScope(["prop-b"]));
    wireUsers("LEASING_AGENT");
    h.db.userPropertyAccess.findMany.mockResolvedValue([{ propertyId: "prop-a" }]);
    const r = await removeUserFromOrgAsClient({ userId: TARGET });
    expect(r.ok).toBe(false);
    expect(h.db.user.delete).not.toHaveBeenCalled();
  });

  it("can remove a teammate on prop-b only", async () => {
    h.scope.mockResolvedValue(clientScope(["prop-b"]));
    wireUsers("LEASING_AGENT");
    h.db.userPropertyAccess.findMany.mockResolvedValue([{ propertyId: "prop-b" }]);
    const r = await removeUserFromOrgAsClient({ userId: TARGET });
    expect(r.ok).toBe(true);
  });
});
