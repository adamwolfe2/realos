import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// ---------------------------------------------------------------------------
// Regression: requireAdmin() / requireAdminOrRep() must look the caller up by
// User.clerkUserId, not User.id.
//
// auth() hands back a Clerk user id (`user_...`); User.id is a cuid and the
// Clerk id lives in User.clerkUserId (@unique). Keying the lookup on `id`
// resolves null for every real session, so every /api/admin route behind these
// helpers answered 403 Forbidden to genuine admins.
//
// Unlike auth-boundaries.test.ts (which stubs findUnique unconditionally and so
// cannot see the wrong column), these tests back findUnique with a tiny store
// that ONLY resolves a row when queried by clerkUserId — the same contract
// Prisma enforces against the real schema.
//
// The role gate itself is deliberately untouched by the fix, so the deny cases
// below re-assert that a non-admin role is still refused.
// ---------------------------------------------------------------------------

let mockPrisma: MockPrisma;
const mockAuth = vi.fn();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

const { requireAdmin, requireAdminOrRep } = await import(
  "@/lib/auth/require-admin"
);

const CLERK_ID = "user_2abcCLERK";
const INTERNAL_ID = "ckq1internalcuid0000";

/**
 * Stands in for the User table: a single row whose internal id and Clerk id
 * differ. Resolves on `where.clerkUserId` only — a lookup by `where.id` (or by
 * any other Clerk id) returns null, exactly as Postgres would. The row carries
 * an `org.orgType` because requireAdmin now requires BOTH an agency role AND an
 * AGENCY-typed org (mirrors requireAgency).
 */
function seedUser(role: string, orgType: string = "AGENCY") {
  mockPrisma.user.findUnique.mockImplementation(
    async ({ where }: { where: { id?: string; clerkUserId?: string } }) =>
      where.clerkUserId === CLERK_ID
        ? { id: INTERNAL_ID, role, org: { orgType } }
        : null,
  );
}

describe("require-admin resolves the caller by clerkUserId", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockAuth.mockReset();
    mockAuth.mockResolvedValue({ userId: CLERK_ID });
  });

  // Roles updated 2026-07-31 (audit P1-1): the helper now checks real
  // UserRole enum values (AGENCY_*), not the phantom "ADMIN"/"OPS"/
  // "SALES_REP" strings that 403'd everyone in production.
  it("requireAdmin queries User.clerkUserId, never User.id", async () => {
    seedUser("AGENCY_OWNER");

    await requireAdmin();

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkUserId: CLERK_ID } }),
    );
  });

  it("requireAdmin admits an admin whose internal id differs from the Clerk id", async () => {
    seedUser("AGENCY_ADMIN");

    const result = await requireAdmin();

    expect(result.error).toBeNull();
    // Must be the INTERNAL User.id — callers persist this into
    // AuditEvent.userId (FK to User.id); the Clerk id would violate it.
    expect(result.userId).toBe(INTERNAL_ID);
  });

  it("requireAdmin still refuses a non-admin role found by clerkUserId", async () => {
    seedUser("CLIENT_VIEWER");

    const result = await requireAdmin();

    expect(result.userId).toBeNull();
    expect(result.error).not.toBeNull();
    const body = await result.error!.json();
    expect(body.error).toBe("Forbidden");
  });

  it("requireAdminOrRep queries User.clerkUserId and admits a rep", async () => {
    seedUser("AGENCY_OPERATOR");

    const result = await requireAdminOrRep();

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkUserId: CLERK_ID } }),
    );
    expect(result.error).toBeNull();
    expect(result.userId).toBe(INTERNAL_ID);
  });

  it("requireAdminOrRep still refuses a client role", async () => {
    seedUser("CLIENT_OWNER");

    const result = await requireAdminOrRep();

    expect(result.userId).toBeNull();
    const body = await result.error!.json();
    expect(body.error).toBe("Forbidden");
  });

  it("an unknown Clerk id resolves no row and is refused", async () => {
    seedUser("AGENCY_OWNER");
    mockAuth.mockResolvedValue({ userId: "user_strangerDanger" });

    const result = await requireAdmin();

    expect(result.userId).toBeNull();
    const body = await result.error!.json();
    expect(body.error).toBe("Forbidden");
  });

  // security-audit-remediation: requireAdmin must require an AGENCY-typed org,
  // not an agency ROLE alone. The Clerk membership.deleted handler re-homes
  // removed client users into the agency org, and other flows can leave an
  // agency-ish role on a CLIENT-typed org — a role-only check would hand that
  // user cross-tenant admin over the 13 routes behind this helper.
  it("requireAdmin refuses an agency ROLE attached to a CLIENT-typed org", async () => {
    seedUser("AGENCY_OWNER", "CLIENT");

    const result = await requireAdmin();

    expect(result.userId).toBeNull();
    const body = await result.error!.json();
    expect(body.error).toBe("Forbidden");
  });

  it("requireAdminOrRep refuses an agency role attached to a CLIENT-typed org", async () => {
    seedUser("AGENCY_OPERATOR", "CLIENT");

    const result = await requireAdminOrRep();

    expect(result.userId).toBeNull();
    const body = await result.error!.json();
    expect(body.error).toBe("Forbidden");
  });

  it("requireAdmin admits an agency role on an AGENCY-typed org", async () => {
    seedUser("AGENCY_OWNER", "AGENCY");

    const result = await requireAdmin();

    expect(result.error).toBeNull();
    expect(result.userId).toBe(INTERNAL_ID);
  });
});
