import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// PORTAL-GROWTH-D001: /api/public/chatbot/lead used to return a distinct
// error message for "org doesn't exist / chatbot module off" ("Chatbot not
// enabled for this tenant") vs "org exists but the resolved chatbot config
// is disabled" ("Chatbot disabled"). Since the second message only fires
// once an org is confirmed to exist, comparing response text let a caller
// enumerate real tenant slugs. Both branches must now return the exact same
// error message + status.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  org: null as any,
  lead: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  chatbotConversation: { create: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findUnique: vi.fn(async () => h.org) },
    lead: h.lead,
    chatbotConversation: h.chatbotConversation,
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  chatbotLeadLimiter: null,
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    limit: 1,
    remaining: 1,
    reset: 0,
  })),
  getIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/notifications/lead-notify", () => ({
  notifyLeadCaptured: vi.fn(async () => {}),
}));

vi.mock("@/lib/notifications/create", () => ({
  notifyChatbotLeadCaptured: vi.fn(async () => {}),
}));

vi.mock("@/lib/tenancy/origin-guard", () => ({
  requireMatchingOrigin: vi.fn(async () => ({ ok: true, hostname: "test" })),
}));

const resolveChatbotConfig = vi.fn();
vi.mock("@/lib/chatbot/resolve-config", () => ({
  resolveChatbotConfig: (...args: unknown[]) => resolveChatbotConfig(...args),
}));

const { POST } = await import("@/app/api/public/chatbot/lead/route");

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/public/chatbot/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  slug: "some-slug",
  firstName: "Jane",
  email: "jane@example.com",
};

beforeEach(() => {
  h.org = null;
  resolveChatbotConfig.mockReset();
});

describe("POST /api/public/chatbot/lead — error parity (no slug/org enumeration)", () => {
  it("returns the same message+status for a nonexistent org as for a disabled config", async () => {
    // Case A: org doesn't exist at all.
    h.org = null;
    const resNotFound = await POST(makeRequest(VALID_BODY));
    const jsonNotFound = await resNotFound.json();

    // Case B: org exists, module on, origin ok, but resolved config is off.
    h.org = {
      id: "org_1",
      orgType: "CLIENT",
      moduleChatbot: true,
      properties: [],
    };
    resolveChatbotConfig.mockResolvedValue({ chatbotEnabled: false });
    const resDisabled = await POST(makeRequest(VALID_BODY));
    const jsonDisabled = await resDisabled.json();

    expect(resNotFound.status).toBe(403);
    expect(resDisabled.status).toBe(403);
    expect(jsonNotFound.error).toBe(jsonDisabled.error);
  });

  it("still returns 403 'Chatbot not enabled for this tenant' when the resolved config is disabled", async () => {
    h.org = {
      id: "org_1",
      orgType: "CLIENT",
      moduleChatbot: true,
      properties: [],
    };
    resolveChatbotConfig.mockResolvedValue({ chatbotEnabled: false });
    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Chatbot not enabled for this tenant");
  });
});
