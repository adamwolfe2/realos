import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrgType, ProductLine, UserRole } from "@prisma/client";

// SECURITY_AUDIT IMP-CAP: impersonation older than 8h must stop applying,
// even inside the Clerk session that started it.
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  updateUserMetadata: vi.fn(),
}));

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mocks.auth(),
  clerkClient: async () => ({
    users: {
      getUser: vi.fn().mockResolvedValue({ publicMetadata: {} }),
      updateUserMetadata: mocks.updateUserMetadata.mockResolvedValue({}),
    },
  }),
  currentUser: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: "agency-user",
        clerkUserId: "user_clerk_1",
        orgId: "agency-org",
        role: UserRole.AGENCY_OWNER,
        email: "ops@leasestack.co",
        org: { id: "agency-org", orgType: OrgType.AGENCY, productLine: ProductLine.STUDENT_HOUSING },
      }),
    },
    organization: {
      findUnique: vi.fn().mockResolvedValue({
        id: "client-org",
        orgType: OrgType.CLIENT,
        productLine: ProductLine.STUDENT_HOUSING,
      }),
    },
    userPropertyAccess: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const { requireScope } = await import("@/lib/tenancy/scope");

function impersonatingSince(hoursAgo: number) {
  mocks.auth.mockResolvedValue({
    userId: "user_clerk_1",
    sessionClaims: {
      sid: "session-1",
      publicMetadata: {
        impersonateOrgId: "client-org",
        impersonateSessionId: "session-1",
        impersonateStartedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
      },
    },
  });
}

describe("impersonation 8h cap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies a fresh impersonation", async () => {
    impersonatingSince(1);
    const scope = await requireScope();
    expect(scope.orgId).toBe("client-org");
    expect(scope.isImpersonating).toBe(true);
  });

  it("drops and clears an impersonation older than 8h", async () => {
    impersonatingSince(9);
    const scope = await requireScope();
    expect(scope.orgId).toBe("agency-org");
    expect(scope.isImpersonating).toBe(false);
    expect(mocks.updateUserMetadata).toHaveBeenCalled();
  });
});
