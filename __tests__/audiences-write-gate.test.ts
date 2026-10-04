import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrgType, ProductLine, UserRole } from "@prisma/client";

// Review-A HIGH-3: audience mutations need a write seat on top of Audience
// Sync access; the org Cursive key needs workspace admin. AL_PARTNER keeps
// its existing access by explicit exception. Real scope.ts, mocked Clerk/prisma.

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
  scheduleFindFirst: vi.fn(),
  scheduleDelete: vi.fn(),
  orgUpdate: vi.fn(),
}));

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mocks.auth(),
  clerkClient: () =>
    Promise.resolve({
      users: { getUser: vi.fn().mockResolvedValue({ publicMetadata: {} }) },
    }),
  currentUser: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/billing/trial-status", () => ({
  isWorkspaceReadOnly: () => false,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => mocks.userFindUnique(...a) },
    userPropertyAccess: { findMany: vi.fn().mockResolvedValue([]) },
    organization: {
      findUnique: vi.fn().mockResolvedValue({
        subscriptionStatus: "ACTIVE",
        trialStartedAt: null,
        trialEndsAt: null,
      }),
      update: (...a: unknown[]) => mocks.orgUpdate(...a),
    },
    audienceSyncSchedule: {
      findFirst: (...a: unknown[]) => mocks.scheduleFindFirst(...a),
      delete: (...a: unknown[]) => mocks.scheduleDelete(...a),
    },
    auditEvent: { create: vi.fn() },
  },
}));

const { deleteAudienceSchedule, setOrgAlApiKey } = await import(
  "@/lib/actions/audiences"
);

function seed(role: UserRole, orgType: OrgType = OrgType.CLIENT) {
  mocks.userFindUnique.mockResolvedValue({
    id: "u1",
    clerkUserId: "clerk_u1",
    orgId: "org-1",
    role,
    email: "x@test.dev",
    org: { id: "org-1", orgType, productLine: ProductLine.AUDIENCE_SYNC },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    userId: "clerk_u1",
    sessionClaims: { sid: "s1", publicMetadata: {} },
  });
  mocks.scheduleFindFirst.mockResolvedValue({ id: "s1", segmentId: "seg1" });
});

describe("audience write gates", () => {
  it("CLIENT_VIEWER can't delete a schedule", async () => {
    seed(UserRole.CLIENT_VIEWER);
    await expect(deleteAudienceSchedule("s1")).rejects.toMatchObject({ status: 403 });
    expect(mocks.scheduleDelete).not.toHaveBeenCalled();
  });

  it("CLIENT_ADMIN can delete a schedule", async () => {
    seed(UserRole.CLIENT_ADMIN);
    await expect(deleteAudienceSchedule("s1")).resolves.toEqual({ ok: true });
  });

  it("AL_PARTNER keeps schedule access (explicit exception)", async () => {
    seed(UserRole.AL_PARTNER, OrgType.AGENCY);
    await expect(deleteAudienceSchedule("s1")).resolves.toEqual({ ok: true });
  });

  it("LEASING_AGENT can't set the org Cursive key", async () => {
    seed(UserRole.LEASING_AGENT);
    await expect(setOrgAlApiKey("abcdefgh1234")).rejects.toMatchObject({
      status: 403,
    });
    expect(mocks.orgUpdate).not.toHaveBeenCalled();
  });
});
