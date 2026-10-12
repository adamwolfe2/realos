import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrgType, ProductLine, UserRole } from "@prisma/client";

// AL_PARTNER was dropped from the UserRole enum (pixel retirement, S4). These
// cases keep proving that an unrecognised role fails closed.
const RETIRED_ROLE = "AL_PARTNER" as unknown as UserRole;

// F-002: AL_PARTNER is not an agency admin. The Audience Sync product was
// retired, so AL_PARTNER now has no cross-org access at all: requireAgency
// and impersonation (of any org, including legacy AUDIENCE_SYNC ones) reject it.

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
  orgFindUnique: vi.fn(),
  updateUserMetadata: vi.fn(),
}));

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mocks.auth(),
  clerkClient: () =>
    Promise.resolve({
      users: {
        getUser: vi.fn().mockResolvedValue({ publicMetadata: {} }),
        updateUserMetadata: (...a: unknown[]) => mocks.updateUserMetadata(...a),
      },
    }),
  currentUser: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => mocks.userFindUnique(...a) },
    userPropertyAccess: { findMany: vi.fn().mockResolvedValue([]) },
    organization: { findUnique: (...a: unknown[]) => mocks.orgFindUnique(...a) },
    auditEvent: { create: vi.fn() },
  },
}));

const { requireAgency, requireScope, ForbiddenError } = await import(
  "@/lib/tenancy/scope"
);
const { startImpersonation } = await import("@/lib/tenancy/impersonate");

function seed(role: UserRole) {
  mocks.userFindUnique.mockResolvedValue({
    id: "u1",
    clerkUserId: "clerk_u1",
    orgId: "agency-org",
    role,
    email: "p@partner.test",
    org: {
      id: "agency-org",
      orgType: OrgType.AGENCY,
      productLine: ProductLine.STUDENT_HOUSING,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    userId: "clerk_u1",
    sessionId: "s1",
    sessionClaims: { sid: "s1", publicMetadata: {} },
  });
});

describe("AL_PARTNER is not agency (F-002)", () => {
  it("AL_PARTNER gets 403 from requireAgency", async () => {
    seed(RETIRED_ROLE);
    const err = await requireAgency().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as InstanceType<typeof ForbiddenError>).status).toBe(403);
  });

  it("AGENCY_ADMIN still passes requireAgency", async () => {
    seed(UserRole.AGENCY_ADMIN);
    await expect(requireAgency()).resolves.toMatchObject({ isAgency: true });
  });

  it("AL_PARTNER has no impersonation or agency flag", async () => {
    seed(RETIRED_ROLE);
    await expect(requireScope()).resolves.toMatchObject({
      isAgency: false,
    });
  });

  it("AL_PARTNER cannot impersonate any org, including legacy AUDIENCE_SYNC", async () => {
    seed(RETIRED_ROLE);
    for (const productLine of [ProductLine.STUDENT_HOUSING, "AUDIENCE_SYNC" as unknown as ProductLine]) {
      mocks.orgFindUnique.mockResolvedValue({
        id: "c1",
        name: "C",
        orgType: OrgType.CLIENT,
        slug: "c",
        productLine,
      });
      await expect(startImpersonation("c1")).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(mocks.updateUserMetadata).not.toHaveBeenCalled();
  });
});
