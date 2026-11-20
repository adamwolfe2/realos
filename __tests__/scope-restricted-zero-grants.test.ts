// A seat limited to specific properties must not become org-wide when its
// last grant disappears (property deleted, rows cascade). Zero grants +
// User.propertyAccessRestricted => the resolver refuses the session.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ findUser: vi.fn(), findGrants: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "clerk_1", sessionClaims: {} }),
  clerkClient: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: h.findUser },
    userPropertyAccess: { findMany: h.findGrants },
  },
}));

const { getScope, ForbiddenError } = await import("@/lib/tenancy/scope");

function user(propertyAccessRestricted: boolean) {
  return {
    id: "u1",
    clerkUserId: "clerk_1",
    email: "a@b.co",
    role: "CLIENT_ADMIN",
    orgId: "org1",
    propertyAccessRestricted,
    org: { id: "org1", orgType: "CLIENT", productLine: null },
  };
}

describe("getScope with zero property grants", () => {
  beforeEach(() => {
    h.findUser.mockReset();
    h.findGrants.mockReset();
  });

  it("refuses a restricted seat that lost every grant", async () => {
    h.findUser.mockResolvedValue(user(true));
    h.findGrants.mockResolvedValue([]);
    await expect(getScope()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("keeps a never-restricted seat org-wide", async () => {
    h.findUser.mockResolvedValue(user(false));
    h.findGrants.mockResolvedValue([]);
    expect((await getScope())?.allowedPropertyIds).toBeNull();
  });

  it("keeps a restricted seat on its granted properties", async () => {
    h.findUser.mockResolvedValue(user(true));
    h.findGrants.mockResolvedValue([{ propertyId: "p1" }]);
    expect((await getScope())?.allowedPropertyIds).toEqual(["p1"]);
  });
});
