import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrgType, ProductLine, UserRole } from "@prisma/client";

// A failed property-grant lookup must not resolve as "unrestricted".
const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({
    userId: "user_clerk_1",
    sessionClaims: { sid: "s1", publicMetadata: {} },
  }),
  clerkClient: async () => ({ users: { getUser: vi.fn(), updateUserMetadata: vi.fn() } }),
  currentUser: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: "agent-1",
        clerkUserId: "user_clerk_1",
        orgId: "client-org",
        role: UserRole.CLIENT_VIEWER,
        email: "agent@example.com",
        org: { id: "client-org", orgType: OrgType.CLIENT, productLine: ProductLine.STUDENT_HOUSING },
      }),
    },
    organization: { findUnique: vi.fn() },
    userPropertyAccess: { findMany: mocks.findMany },
  },
}));

const { requireScope } = await import("@/lib/tenancy/scope");

describe("property grants fail closed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restricts to granted properties", async () => {
    mocks.findMany.mockResolvedValue([{ propertyId: "prop-a" }]);
    const scope = await requireScope();
    expect(scope.allowedPropertyIds).toEqual(["prop-a"]);
  });

  it("does not grant the whole portfolio when the lookup fails", async () => {
    mocks.findMany.mockRejectedValue(new Error("pool timeout"));
    await expect(requireScope()).rejects.toThrow();
  });
});
