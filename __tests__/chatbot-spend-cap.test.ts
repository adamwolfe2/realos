import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// F-139: tenant chat + public widget chat run under the global Anthropic
// spend cap, but the cap NEVER blocks a paying org (same rule as
// checkAiQuota's neverBlock, via isPayingSubscription).

const h = vi.hoisted(() => ({
  org: { current: null as unknown },
  groupBy: vi.fn(),
  streamText: vi.fn(),
  logUsage: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("ai", () => ({ streamText: h.streamText }));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: (m: string) => m }));
vi.mock("@/lib/cost-tracker/log", () => ({
  logUsage: h.logUsage,
  microCentsToUsd: (mc: number) => mc / 100_000_000,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    apiUsage: { groupBy: h.groupBy },
    organization: { findUnique: async () => h.org.current },
    chatbotConversation: { findFirst: async () => null },
    propertyKnowledgeBase: { findFirst: async () => null },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  publicApiLimiter: "p",
  WIDGET_FALLBACK: { publicApi: {} },
  checkRateLimit: async () => ({ allowed: true }),
  getIp: () => "1.2.3.4",
}));
vi.mock("@/lib/ai/quota", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/quota")>()),
  checkAiQuota: async () => ({ allowed: true, count: 0, limit: 1 }),
}));
vi.mock("@/lib/chatbot/log-chat-usage", () => ({ logChatUsage: vi.fn() }));
vi.mock("@/lib/tenancy/origin-guard", () => ({
  requireMatchingOrigin: async () => ({ ok: true }),
  chatbotOriginBypassEnabled: () => true,
}));
vi.mock("@/lib/chatbot/resolve-config", () => ({
  resolveChatbotConfig: async () => ({ chatbotEnabled: true }),
}));
vi.mock("@/lib/chatbot/build-system-prompt", () => ({
  buildSystemPrompt: () => "sys",
}));
vi.mock("@/lib/billing/trial-status", async (orig) => ({
  ...(await orig<typeof import("@/lib/billing/trial-status")>()),
  liveFeaturesPaused: () => false,
}));
vi.mock("@/lib/sentry", () => ({ captureWithContext: h.capture }));
vi.mock("@/lib/notifications/lead-notify", () => ({ notifyLeadCaptured: vi.fn() }));
vi.mock("@/lib/notifications/create", () => ({ notifyChatbotLeadCaptured: vi.fn() }));
vi.mock("@/lib/chatbot/find-or-create-lead", () => ({ findOrCreateChatbotLead: vi.fn() }));
vi.mock("@/lib/chatbot/send-prospect-profile", () => ({
  sendProspectProfileForConversation: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ withScope: vi.fn(), captureMessage: vi.fn() }));

import { __resetCapStateForTest } from "@/lib/cost-tracker/cap";
import { POST as tenantChat } from "@/app/api/chat/route";
import { POST as publicChat } from "@/app/api/public/chatbot/chat/route";

function org(
  subscriptionStatus: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id: "org1",
    slug: "acme",
    orgType: "CLIENT",
    status: "ACTIVE",
    moduleChatbot: true,
    subscriptionStatus,
    tenantSiteConfig: {},
    properties: [],
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    ...extra,
  };
}

const payload = JSON.stringify({
  orgId: "org1",
  slug: "acme",
  sessionId: "11111111-1111-4111-8111-111111111111",
  messages: [{ role: "user", content: "hi" }],
});
const req = (path: string) =>
  new NextRequest(`http://localhost${path}`, { method: "POST", body: payload });

const routes = [
  ["/api/chat", tenantChat],
  ["/api/public/chatbot/chat", publicChat],
] as const;

const overCap = [
  { provider: "anthropic", _sum: { costMicroCents: 500 * 100_000_000 } },
];

beforeEach(() => {
  vi.clearAllMocks();
  __resetCapStateForTest();
  process.env.CHATBOT_ALLOW_ANY_ORIGIN = "true";
  // Month-to-date spend far above the default $200 global cap.
  h.groupBy.mockResolvedValue(overCap);
  h.streamText.mockReturnValue({ toTextStreamResponse: () => new Response("hi") });
});

describe.each(routes)("%s under the global spend cap", (path, POST) => {
  it.each(["ACTIVE", "PAST_DUE"])(
    "never blocks or even checks spend for a %s org over the cap",
    async (status) => {
      h.org.current = org(status);
      const res = await POST(req(path));
      expect(res.status).toBe(200);
      expect(h.streamText).toHaveBeenCalledTimes(1);
      expect(h.groupBy).not.toHaveBeenCalled();
    },
  );

  it("never blocks a trial with a card on file", async () => {
    h.org.current = org("TRIALING", { currentPeriodEnd: new Date() });
    const res = await POST(req(path));
    expect(res.status).toBe(200);
    expect(h.groupBy).not.toHaveBeenCalled();
  });

  it("allows a trial org with no card while under the cap", async () => {
    h.groupBy.mockResolvedValue([
      { provider: "anthropic", _sum: { costMicroCents: 5 * 100_000_000 } },
    ]);
    h.org.current = org("TRIALING");
    const res = await POST(req(path));
    expect(res.status).toBe(200);
  });

  it("blocks a trial org with no card over the cap: shared 503 shape, real Retry-After, one alert", async () => {
    h.org.current = org("TRIALING");
    const res = await POST(req(path));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Chatbot temporarily unavailable",
      code: "spend_cap_reached",
    });
    const retry = Number(res.headers.get("Retry-After"));
    expect(retry).toBeGreaterThan(3600 - 1);
    expect(retry).toBeLessThanOrEqual(31 * 86_400);
    expect(h.streamText).not.toHaveBeenCalled();
    expect(h.logUsage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SKIPPED_CAP" }),
    );
    await POST(req(path));
    expect(h.capture).toHaveBeenCalledTimes(1);
  });

  it("fails open when the spend lookup throws", async () => {
    h.groupBy.mockRejectedValue(new Error("pool exhausted"));
    h.org.current = org("TRIALING");
    const res = await POST(req(path));
    expect(res.status).toBe(200);
    expect(h.capture).toHaveBeenCalled();
  });

  it("caches the month total between calls", async () => {
    h.org.current = org("TRIALING");
    await POST(req(path));
    await POST(req(path));
    expect(h.groupBy).toHaveBeenCalledTimes(1);
  });
});
