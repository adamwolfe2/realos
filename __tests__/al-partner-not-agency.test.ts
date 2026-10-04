import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrgType, ProductLine, UserRole } from "@prisma/client";

// F-002: AL_PARTNER is an external partner scoped to AUDIENCE_SYNC orgs, not
// an agency admin. requireAgency must reject it; requireAudienceSync and
// AUDIENCE_SYNC-only impersonation keep working.

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

const { requireAgency, requireAudienceSync, ForbiddenError } = await import(
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
    seed(UserRole.AL_PARTNER);
    const err = await requireAgency().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as InstanceType<typeof ForbiddenError>).status).toBe(403);
  });

  it("AGENCY_ADMIN still passes requireAgency", async () => {
    seed(UserRole.AGENCY_ADMIN);
    await expect(requireAgency()).resolves.toMatchObject({ isAgency: true });
  });

  it("AL_PARTNER still passes requireAudienceSync", async () => {
    seed(UserRole.AL_PARTNER);
    await expect(requireAudienceSync()).resolves.toMatchObject({
      isAgency: false,
      isAlPartner: true,
    });
  });

  it("AL_PARTNER can impersonate an AUDIENCE_SYNC org only", async () => {
    seed(UserRole.AL_PARTNER);
    mocks.orgFindUnique.mockResolvedValue({
      id: "c1",
      name: "C",
      orgType: OrgType.CLIENT,
      slug: "c",
      productLine: ProductLine.STUDENT_HOUSING,
    });
    await expect(startImpersonation("c1")).rejects.toBeInstanceOf(ForbiddenError);
    expect(mocks.updateUserMetadata).not.toHaveBeenCalled();

    mocks.orgFindUnique.mockResolvedValue({
      id: "c2",
      name: "C2",
      orgType: OrgType.CLIENT,
      slug: "c2",
      productLine: ProductLine.AUDIENCE_SYNC,
    });
    await expect(startImpersonation("c2")).resolves.toMatchObject({ ok: true });
  });
});
