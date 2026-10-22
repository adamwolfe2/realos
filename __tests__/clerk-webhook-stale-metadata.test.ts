import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";

// Clerk public_metadata.role/orgId is stamped at invite time and never
// updated by team role changes or removals. It must never create or restore
// membership on its own: the invite's seed_pending_ row is the durable record.
// Runs the webhook against the real provisionUserForClerk over a tiny
// in-memory User table.
type Row = {
  id: string;
  clerkUserId: string;
  email: string;
  role: UserRole;
  orgId: string;
  org: { orgType: string; slug: string };
};

const mocks = vi.hoisted(() => ({
  event: null as unknown,
  rows: [] as Row[],
  upsert: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  orgFindFirst: vi.fn(),
}));

function find(where: { clerkUserId?: string; email?: string; id?: string }) {
  return (
    mocks.rows.find(
      (r) =>
        (where.clerkUserId !== undefined && r.clerkUserId === where.clerkUserId) ||
        (where.email !== undefined && r.email === where.email) ||
        (where.id !== undefined && r.id === where.id),
    ) ?? null
  );
}

vi.mock("svix", () => ({
  Webhook: class {
    verify() {
      return mocks.event;
    }
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  webhookLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getIp: () => "1.1.1.1",
  rateLimited: vi.fn(),
}));
vi.mock("@/lib/sentry", () => ({ captureWithContext: vi.fn() }));
vi.mock("@/lib/analytics-server", () => ({ trackServer: vi.fn() }));
vi.mock("@/lib/notifications/funnel-alert", () => ({ alertFunnelStep: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: {
      // The invited org exists, so the old metadata path would bind to it.
      findUnique: vi.fn(async ({ where }) => (where.id === "org-1" ? { id: "org-1" } : null)),
      findFirst: mocks.orgFindFirst,
    },
    user: {
      upsert: mocks.upsert,
      findUnique: vi.fn(async ({ where }) => find(where)),
      update: mocks.update.mockImplementation(async ({ where, data }) => {
        const row = find(where);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      }),
      create: mocks.create.mockImplementation(async ({ data }) => ({
        id: "new",
        role: data.role,
        orgId: "fresh-org",
        org: { orgType: "CLIENT", slug: "fresh" },
      })),
    },
  },
}));

process.env.CLERK_WEBHOOK_SECRET = "whsec_test";
const { POST } = await import("@/app/api/webhooks/clerk/route");

function send(type: "user.created" | "user.updated") {
  mocks.event = {
    type,
    data: {
      id: "user_1",
      email_addresses: [{ email_address: "a@example.com" }],
      first_name: "A",
      last_name: "B",
      public_metadata: { orgId: "org-1", role: UserRole.CLIENT_ADMIN },
    },
  };
  const req = new Request("https://x/api/webhooks/clerk", {
    method: "POST",
    headers: { "svix-id": "1", "svix-timestamp": "1", "svix-signature": "s" },
    body: "{}",
  });
  return POST(req as never);
}

function seed(overrides: Partial<Row> = {}) {
  mocks.rows.push({
    id: "u1",
    clerkUserId: "seed_pending_a@example.com",
    email: "a@example.com",
    role: UserRole.CLIENT_VIEWER,
    orgId: "org-1",
    org: { orgType: "CLIENT", slug: "tenant" },
    ...overrides,
  });
}

function boundToOrg1() {
  const createdInOrg1 = mocks.create.mock.calls.some(
    ([a]) => a.data.orgId === "org-1" || a.data.org?.connect?.id === "org-1",
  );
  const rowInOrg1 = mocks.rows.some(
    (r) => r.clerkUserId === "user_1" && r.orgId === "org-1",
  );
  return createdInOrg1 || rowInOrg1 || mocks.upsert.mock.calls.length > 0;
}

describe("clerk webhook never trusts stale invite metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows.length = 0;
    mocks.orgFindFirst.mockResolvedValue(null);
  });

  it("user.created claims the invite seed with the seed's current role", async () => {
    seed(); // demoted to CLIENT_VIEWER since the CLIENT_ADMIN invite
    const res = await send("user.created");
    expect(res.status).toBe(200);
    expect(mocks.rows[0]).toMatchObject({
      clerkUserId: "user_1",
      orgId: "org-1",
      role: UserRole.CLIENT_VIEWER,
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("a replayed user.created after removal does not re-create membership", async () => {
    // manage-team deleted the row (and the seed is gone), metadata remains.
    await send("user.created");
    expect(boundToOrg1()).toBe(false);
  });

  it("a retried user.created does not touch an already-claimed row's role", async () => {
    seed({ clerkUserId: "user_1" });
    await send("user.created");
    expect(mocks.rows[0].role).toBe(UserRole.CLIENT_VIEWER);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("a seeded invitee resolves through the seed, not the primary-contact match", async () => {
    mocks.orgFindFirst.mockResolvedValue({ id: "org-2" });
    seed();
    await send("user.created");
    expect(mocks.orgFindFirst).not.toHaveBeenCalled();
    expect(mocks.rows[0].orgId).toBe("org-1");
  });

  it("an owner invite (no seed) still binds via the new org's primary contact", async () => {
    // createClientDirect / convertIntakeToClient / inviteOwnerForProvisionedOrg
    // set org.primaryContactEmail to the invitee and create no seed row.
    mocks.orgFindFirst.mockResolvedValue({ id: "org-1" });
    await send("user.created");
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][0].create.org).toEqual({ connect: { id: "org-1" } });
  });

  it("owner primary-contact match is an escaped case-insensitive equals", async () => {
    mocks.orgFindFirst.mockResolvedValue({ id: "org-1" });
    await send("user.created");
    expect(mocks.orgFindFirst.mock.calls[0][0].where).toEqual({
      primaryContactEmail: { equals: "a@example.com", mode: "insensitive" },
    });
  });

  it("does not restore a demoted user's old role on user.updated", async () => {
    seed({ clerkUserId: "user_1" });
    await send("user.updated");
    expect(mocks.upsert).not.toHaveBeenCalled();
    // Profile still syncs, just without the role.
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][0].data.role).toBeUndefined();
  });

  it("does not re-create a removed teammate on user.updated", async () => {
    await send("user.updated");
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
