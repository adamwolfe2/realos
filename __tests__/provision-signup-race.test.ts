import { describe, it, expect, vi, beforeEach } from "vitest";

// F-004: the Clerk webhook, /api/auth/role and the scope self-heal all
// provision the same brand-new user at once. The loser of the create race
// hits a unique-constraint error (P2002) and must resolve to the row the
// winner created, not dead-end the user on "no role".

const h = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    organization: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
  provision: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/analytics-server", () => ({ trackServer: vi.fn() }));
vi.mock("@/lib/notifications/funnel-alert", () => ({
  alertFunnelStep: vi.fn(),
}));

const ARGS = {
  clerkUserId: "user_abc",
  email: "New@Example.com",
  firstName: "Ann",
  lastName: null,
};
const WINNER = {
  id: "u1",
  role: "CLIENT_OWNER",
  orgId: "o1",
  org: { orgType: "CLIENT", slug: "new" },
};
const p2002 = Object.assign(new Error("Unique constraint failed"), {
  code: "P2002",
});

describe("provisionUserForClerk create race", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    h.db.organization.findUnique.mockResolvedValue(null);
    h.db.organization.findFirst.mockResolvedValue(null); // no owner-invite org
  });

  it("returns the winner's row when create loses a P2002 race", async () => {
    const { provisionUserForClerk } = await import("@/lib/auth/provision");
    // Initial lookups miss; after the failed create the clerkUserId lookup hits.
    h.db.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(WINNER);
    h.db.user.create.mockRejectedValueOnce(p2002);

    const r = await provisionUserForClerk(ARGS);

    expect(r).toEqual({ ...WINNER, created: false });
    expect(h.db.user.create).toHaveBeenCalledTimes(1);
  });

  it("rethrows a P2002 when this Clerk user has no row afterwards", async () => {
    const { provisionUserForClerk } = await import("@/lib/auth/provision");
    h.db.user.findUnique.mockResolvedValue(null);
    h.db.user.create.mockRejectedValueOnce(p2002);

    await expect(provisionUserForClerk(ARGS)).rejects.toBe(p2002);
  });

  it("rethrows non-unique errors untouched", async () => {
    const { provisionUserForClerk } = await import("@/lib/auth/provision");
    h.db.user.findUnique.mockResolvedValue(null);
    const boom = new Error("db down");
    h.db.user.create.mockRejectedValueOnce(boom);

    await expect(provisionUserForClerk(ARGS)).rejects.toBe(boom);
    expect(h.db.user.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe("GET /api/auth/role on provisioning failure", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@clerk/nextjs/server", () => ({
      auth: async () => ({ userId: "user_abc" }),
      currentUser: async () => ({
        primaryEmailAddressId: "e1",
        emailAddresses: [{ id: "e1", emailAddress: "new@example.com" }],
        firstName: null,
        lastName: null,
      }),
    }));
    vi.doMock("@/lib/auth/provision", () => ({
      provisionUserForClerk: h.provision,
    }));
  });

  it("returns 500 so the redirect page retries instead of showing no-role", async () => {
    h.provision.mockRejectedValueOnce(new Error("transient"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await import("@/app/api/auth/role/route");

    const res = await GET();
    spy.mockRestore();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ role: null });
  });
});
