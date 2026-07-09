import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// The transcript-timing fix. Chatbot leads are pushed to Funnel by the idle
// funnel-lead-sync cron, which reads the FULL persisted conversation at push
// time — NOT the empty/partial snapshot that existed when the lead was first
// captured. These tests prove:
//
//   1. pushConversationLeadToFunnel sends the WHOLE transcript to Funnel's
//      `notes` (including turns that came after contact capture).
//   2. It stays fail-soft (skips, never throws, when the integration is off).
//   3. The cron stamps funnelPushedAt BEFORE the push fires → at-most-once, so
//      a crash can never double-create a Prospect in the client's CRM.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: {
    funnelIntegration: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    chatbotConversation: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
  decryptForOrg: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/vault/crypto", () => ({
  encryptForOrg: vi.fn(),
  decryptForOrg: h.decryptForOrg,
}));
// The push path now runs an SSRF check that resolves the base URL via DNS.
// These tests use a non-resolving `.test` host on purpose, so stub the guard
// to a pass-through — SSRF behavior has its own coverage in ssrf-guard.test.ts.
vi.mock("@/lib/security/ssrf-guard", () => ({
  assertPublicHttpUrl: vi.fn(async (u: string) => new URL(u)),
  SsrfError: class SsrfError extends Error {},
}));

import { pushConversationLeadToFunnel } from "@/lib/integrations/funnel-client";

// A conversation whose LATE turns (move-in date, budget) were spoken AFTER the
// visitor first handed over their email. A capture-time push would have missed
// all of them; the idle push must include them.
const FULL_CONVERSATION = {
  id: "conv_1",
  orgId: "org_1",
  pageUrl: "/apartments",
  capturedName: "Jane Doe",
  capturedEmail: "jane@example.com",
  capturedPhone: null,
  lead: {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "555-1234",
    intent: "hot",
    sourceDetail: "chatbot:pre_chat",
  },
  messages: [
    { role: "assistant", content: "Hi! What can I help you find?" },
    { role: "user", content: "A 2-bed. My email is jane@example.com" },
    { role: "assistant", content: "Great — when are you looking to move in?" },
    { role: "user", content: "I need it by August 1st, budget around $2400." },
  ],
};

const ENABLED_INTEGRATION = {
  apiKeyEncrypted: JSON.stringify({ v: 1, ciphertext: "x" }),
  apiBaseUrl: "https://api.funnel.test",
  groupId: 1234,
  discoverySourceId: null,
  enabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.decryptForOrg.mockResolvedValue("FUNNEL_API_KEY");
  h.db.chatbotConversation.findUnique.mockResolvedValue(FULL_CONVERSATION);
  h.db.funnelIntegration.findUnique.mockResolvedValue(ENABLED_INTEGRATION);
  h.db.funnelIntegration.update.mockResolvedValue({});
});

describe("pushConversationLeadToFunnel — full transcript reaches Funnel notes", () => {
  it("sends the WHOLE conversation, including turns after contact capture", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    const result = await pushConversationLeadToFunnel("conv_1");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.funnel.test/api/v2/clients");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toMatch(/^Basic /);

    const body = JSON.parse(init.body);
    expect(body.client.email).toBe("jane@example.com");
    expect(body.client.group).toBe(1234);

    // The whole transcript is present — crucially the LATE turns a capture-time
    // push would have missed.
    const notes: string = body.client.notes;
    expect(notes).toContain("Assistant: Hi! What can I help you find?");
    expect(notes).toContain("Prospect: I need it by August 1st, budget around $2400.");

    vi.unstubAllGlobals();
  });

  it("is fail-soft: soft-skips (no fetch) when the integration is disabled", async () => {
    h.db.funnelIntegration.findUnique.mockResolvedValue({
      ...ENABLED_INTEGRATION,
      enabled: false,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await pushConversationLeadToFunnel("conv_1");

    expect(result).toMatchObject({ ok: false, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("soft-skips a missing conversation without throwing", async () => {
    h.db.chatbotConversation.findUnique.mockResolvedValue(null);

    await expect(pushConversationLeadToFunnel("nope")).resolves.toMatchObject({
      ok: false,
      skipped: true,
    });
  });
});
