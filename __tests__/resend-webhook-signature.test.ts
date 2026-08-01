import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Coverage gap: /api/webhooks/resend was the outlier among the four
// webhook routes (clerk/cursive/stripe all have dedicated test files) with
// zero test coverage on its Svix-style HMAC signature verification. Unlike
// the other three (structural string-matching only), this test drives the
// real POST handler end-to-end with a genuine HMAC signature — the
// verifySignature() function isn't exported, so this is the only way to
// actually exercise it rather than just asserting the source contains
// certain strings.
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = "test_resend_secret";

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

function signedRequest(body: string, opts?: { secret?: string; ageMs?: number }) {
  const secret = opts?.secret ?? WEBHOOK_SECRET;
  const svixId = "msg_test123";
  const tsSeconds = Math.floor((Date.now() - (opts?.ageMs ?? 0)) / 1000);
  const toSign = `${svixId}.${tsSeconds}.${body}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(toSign)
    .digest("base64");

  return new Request("https://x/api/webhooks/resend", {
    method: "POST",
    body,
    headers: {
      "svix-id": svixId,
      "svix-timestamp": String(tsSeconds),
      "svix-signature": `v1,${signature}`,
    },
  }) as unknown as import("next/server").NextRequest;
}

const originalSecret = process.env.RESEND_WEBHOOK_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
  h.db.lead.findMany.mockResolvedValue([]);
});

afterAll(() => {
  process.env.RESEND_WEBHOOK_SECRET = originalSecret;
});

describe("POST /api/webhooks/resend — signature verification", () => {
  it("accepts a request with a valid HMAC signature", async () => {
    const body = JSON.stringify({ type: "email.opened", data: { to: "a@example.com" } });
    const res = (await POST(signedRequest(body))) as Response;
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("rejects a request with an invalid signature", async () => {
    const body = JSON.stringify({ type: "email.opened", data: { to: "a@example.com" } });
    const res = (await POST(signedRequest(body, { secret: "wrong_secret" }))) as Response;
    expect(res.status).toBe(401);
  });

  it("rejects a request signed with a stale timestamp (replay guard)", async () => {
    const body = JSON.stringify({ type: "email.opened", data: { to: "a@example.com" } });
    // 10 minutes old — outside the 5-minute Svix tolerance window.
    const res = (await POST(signedRequest(body, { ageMs: 10 * 60 * 1000 }))) as Response;
    expect(res.status).toBe(401);
  });

  it("fails closed when RESEND_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const body = JSON.stringify({ type: "email.opened", data: { to: "a@example.com" } });
    const res = (await POST(signedRequest(body))) as Response;
    expect(res.status).toBe(401);
  });

  it("rejects a request missing svix headers entirely", async () => {
    const body = JSON.stringify({ type: "email.opened", data: { to: "a@example.com" } });
    const res = (await POST(
      new Request("https://x/api/webhooks/resend", {
        method: "POST",
        body,
      }) as unknown as import("next/server").NextRequest,
    )) as Response;
    expect(res.status).toBe(401);
  });
});
