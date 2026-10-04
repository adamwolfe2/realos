import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import crypto from "node:crypto";

// Engagement mapping for /api/webhooks/resend (signature handling is covered
// in resend-webhook-signature.test.ts). Drives the real POST handler with a
// valid signature and a mocked prisma client.

const WEBHOOK_SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

const h = vi.hoisted(() => ({
  db: {
    lead: { findMany: vi.fn(), updateMany: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/rate-limit", () => ({
  webhookLimiter: {},
  checkRateLimit: async () => ({ allowed: true }),
  getIp: () => "127.0.0.1",
  rateLimited: (message: string) =>
    new Response(JSON.stringify({ error: message }), { status: 429 }),
}));

import { POST } from "@/app/api/webhooks/resend/route";

function signed(type: string, to: string) {
  const body = JSON.stringify({ type, data: { to } });
  const id = "msg_eng1";
  const ts = Math.floor(Date.now() / 1000);
  const key = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ""), "base64");
  const sig = crypto
    .createHmac("sha256", key)
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
  return new Request("https://x/api/webhooks/resend", {
    method: "POST",
    body,
    headers: {
      "svix-id": id,
      "svix-timestamp": String(ts),
      "svix-signature": `v1,${sig}`,
    },
  }) as unknown as import("next/server").NextRequest;
}

const originalSecret = process.env.RESEND_WEBHOOK_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
  h.db.lead.findMany.mockResolvedValue([]);
  h.db.lead.updateMany.mockResolvedValue({ count: 1 });
  h.db.auditEvent.create.mockResolvedValue({});
});

afterAll(() => {
  process.env.RESEND_WEBHOOK_SECRET = originalSecret;
});

describe("POST /api/webhooks/resend: engagement mapping", () => {
  it("does nothing when no lead matches the recipient", async () => {
    const res = (await POST(signed("email.opened", "nobody@example.com"))) as Response;
    expect(res.status).toBe(200);
    expect(h.db.lead.updateMany).not.toHaveBeenCalled();
    expect(h.db.auditEvent.create).not.toHaveBeenCalled();
  });

  it("stamps lastActivityAt on every matching lead for email.opened", async () => {
    h.db.lead.findMany.mockResolvedValue([
      { id: "l1", orgId: "o1" },
      { id: "l2", orgId: "o2" },
    ]);
    await POST(signed("email.opened", "a@example.com"));
    const call = h.db.lead.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: { in: ["l1", "l2"] } });
    expect(call.data.lastActivityAt).toBeInstanceOf(Date);
    expect(call.data.unsubscribedFromEmails).toBeUndefined();
  });

  it("does not treat email.delivered (our own outbound receipt) as lead activity", async () => {
    h.db.lead.findMany.mockResolvedValue([{ id: "l1", orgId: "o1" }]);
    const res = (await POST(signed("email.delivered", "a@example.com"))) as Response;
    expect(res.status).toBe(200);
    expect(h.db.lead.updateMany).not.toHaveBeenCalled();
    expect(h.db.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes matching leads on email.bounced without touching lastActivityAt", async () => {
    h.db.lead.findMany.mockResolvedValue([{ id: "l1", orgId: "o1" }]);
    await POST(signed("email.bounced", "a@example.com"));
    expect(h.db.lead.updateMany).toHaveBeenCalledTimes(1);
    const data = h.db.lead.updateMany.mock.calls[0][0].data;
    expect(data.unsubscribedFromEmails).toBe(true);
    expect(data.unsubscribedAt).toBeInstanceOf(Date);
    expect(data.lastActivityAt).toBeUndefined();
  });

  it("writes one audit row per matching tenant lead", async () => {
    h.db.lead.findMany.mockResolvedValue([
      { id: "l1", orgId: "o1" },
      { id: "l2", orgId: "o2" },
    ]);
    await POST(signed("email.clicked", "a@example.com"));
    const orgs = h.db.auditEvent.create.mock.calls.map((c) => c[0].data.orgId);
    expect(orgs).toEqual(["o1", "o2"]);
  });
});
