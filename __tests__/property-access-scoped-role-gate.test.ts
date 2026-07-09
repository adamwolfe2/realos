import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// ---------------------------------------------------------------------------
// Regression: the property-access editor (manage-team.ts applyPropertyAccess)
// must NOT let an admin silently escalate a property-scoped teammate to
// org-wide access by clearing their property list.
//
// A LEASING_AGENT / CLIENT_VIEWER with zero UserPropertyAccess rows collapses
// to `allowedPropertyIds = null` in scope.ts == org-wide. The invite endpoint
// already blocks a 0-property assignment for these roles; this second write
// path must enforce the identical invariant (shared PROPERTY_SCOPED_ROLES).
// ---------------------------------------------------------------------------

let mockPrisma: MockPrisma;
const mockRequireAgency = vi.fn();
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
  clerkClient: () => vi.fn(),
}));

class ForbiddenErrorStub extends Error {}

vi.mock("@/lib/tenancy/scope", () => ({
  requireAgency: () => mockRequireAgency(),
  requireWritableWorkspace: () => mockRequireAgency(),
  requireScope: () => mockRequireAgency(),
  ForbiddenError: ForbiddenErrorStub,
  auditPayload: (
    scope: Record<string, unknown>,
    rest: Record<string, unknown>,
  ) => ({ ...scope, ...rest }),
}));

const { updatePropertyAccessAsAgency } = await import(
  "@/lib/actions/manage-team"
);
const { UserRole, OrgType } = await import("@prisma/client");

function agencyScope() {
  return {
    userId: "agency-actor",
    clerkUserId: "clerk_agency-actor",
    orgId: "agency-org",
    actualOrgId: "agency-org",
    orgType: OrgType.AGENCY,
    actualOrgType: OrgType.AGENCY,
    role: UserRole.AGENCY_OWNER,
    email: "actor@agency.test",
    isAgency: true,
    isAlPartner: false,
    isImpersonating: false,
    allowedPropertyIds: null,
  };
}

const VALID_CUID = "ckxxxxxxxxxxxxxxxxxxxxxxx";

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockRequireAgency.mockReset();
  mockRevalidatePath.mockReset();
  mockRequireAgency.mockResolvedValue(agencyScope());
  mockPrisma.$transaction.mockResolvedValue(undefined);
  mockPrisma.auditEvent.create.mockResolvedValue({});
  mockPrisma.property.findMany.mockResolvedValue([{ id: "prop-a" }]);
});

describe("applyPropertyAccess — scoped-role org-wide escalation guard", () => {
  it("rejects clearing all properties for a LEASING_AGENT", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "agent-1",
      orgId: "client-org",
      email: "agent@client.test",
      role: UserRole.LEASING_AGENT,
    });

    const result = await updatePropertyAccessAsAgency({
      userId: VALID_CUID,
      propertyIds: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least one property/i);
    // The invariant guard must fire BEFORE any write.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.userPropertyAccess.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects clearing all properties for a CLIENT_VIEWER", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "viewer-1",
      orgId: "client-org",
      email: "viewer@client.test",
      role: UserRole.CLIENT_VIEWER,
    });

    const result = await updatePropertyAccessAsAgency({
      userId: VALID_CUID,
      propertyIds: [],
    });

    expect(result.ok).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("allows clearing all properties for a CLIENT_ADMIN (org-wide is legitimate for this role)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "admin-1",
      orgId: "client-org",
      email: "admin@client.test",
      role: UserRole.CLIENT_ADMIN,
    });

    const result = await updatePropertyAccessAsAgency({
      userId: VALID_CUID,
      propertyIds: [],
    });

    expect(result.ok).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("allows a LEASING_AGENT scoped to at least one property", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "agent-2",
      orgId: "client-org",
      email: "agent2@client.test",
      role: UserRole.LEASING_AGENT,
    });

    const result = await updatePropertyAccessAsAgency({
      userId: VALID_CUID,
      propertyIds: ["prop-a"],
    });

    expect(result.ok).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
