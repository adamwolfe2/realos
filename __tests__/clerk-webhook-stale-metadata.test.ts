import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";

// Clerk public_metadata.role/orgId is stamped at invite time and never
// updated by team role changes or removals. user.updated must not re-apply it.
const mocks = vi.hoisted(() => ({
  event: null as unknown,
  upsert: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
}));

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
      findUnique: vi.fn().mockResolvedValue({ id: "org-1" }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    user: { upsert: mocks.upsert, update: mocks.update, findUnique: mocks.findUnique },
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

describe("clerk user.updated with stale invite metadata", () => {
  beforeEach(() => vi.clearAllMocks());

  it("user.created still binds the invitee to the metadata org and role", async () => {
    await send("user.created");
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const arg = mocks.upsert.mock.calls[0][0];
    expect(arg.create.role).toBe(UserRole.CLIENT_ADMIN);
    expect(arg.create.org).toEqual({ connect: { id: "org-1" } });
  });

  it("a retried user.created does not overwrite a role changed since invite", async () => {
    await send("user.created");
    expect(mocks.upsert.mock.calls[0][0].update.role).toBeUndefined();
  });

  it("does not restore a demoted user's old role", async () => {
    mocks.findUnique.mockResolvedValue({ id: "u1", orgId: "org-1" });
    await send("user.updated");
    expect(mocks.upsert).not.toHaveBeenCalled();
    // Profile still syncs, just without the role.
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][0].data.role).toBeUndefined();
  });

  it("does not re-create a removed teammate", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await send("user.updated");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
