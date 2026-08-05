import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrgType, ProductLine, UserRole } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
  userFindUnique: vi.fn(),
  propertyAccessFindMany: vi.fn(),
}));

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mocks.auth(),
  clerkClient: () => mocks.clerkClient(),
  currentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mocks.userFindUnique(...args) },
    userPropertyAccess: {
      findMany: (...args: unknown[]) => mocks.propertyAccessFindMany(...args),
    },
  },
}));

const { ForbiddenError, requireAgencyStaffRead } = await import(
  "@/lib/tenancy/scope"
);

function seedScope(role: UserRole, orgType: OrgType) {
  mocks.userFindUnique.mockResolvedValue({
    id: "user-internal-1",
    clerkUserId: "user_clerk_1",
    orgId: "org-1",
    role,
    email: "staff@leasestack.co",
    org: {
      id: "org-1",
      orgType,
      productLine: ProductLine.STUDENT_HOUSING,
    },
  });
}

describe("requireAgencyStaffRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      userId: "user_clerk_1",
      sessionClaims: { sid: "session-1", publicMetadata: {} },
    });
    mocks.clerkClient.mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({ publicMetadata: {} }),
      },
    });
    mocks.propertyAccessFindMany.mockResolvedValue([]);
  });

  it.each([
    UserRole.AGENCY_OWNER,
    UserRole.AGENCY_ADMIN,
    UserRole.AGENCY_OPERATOR,
  ])("allows %s in an agency scope", async (role) => {
    seedScope(role, OrgType.AGENCY);

    const scope = await requireAgencyStaffRead();

    expect(scope.role).toBe(role);
    expect(scope.isAgency).toBe(true);
  });

  it("denies AL_PARTNER even though the existing scope marks it as agency", async () => {
    seedScope(UserRole.AL_PARTNER, OrgType.AGENCY);

    await expect(requireAgencyStaffRead()).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it.each([
    UserRole.CLIENT_OWNER,
    UserRole.CLIENT_ADMIN,
    UserRole.CLIENT_VIEWER,
    UserRole.LEASING_AGENT,
  ])("denies client role %s", async (role) => {
    seedScope(role, OrgType.CLIENT);

    await expect(requireAgencyStaffRead()).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("denies an allowed role when the resolved scope is not agency", async () => {
    seedScope(UserRole.AGENCY_OWNER, OrgType.CLIENT);

    await expect(requireAgencyStaffRead()).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
