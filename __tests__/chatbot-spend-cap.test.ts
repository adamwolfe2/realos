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
vi.mock("@/lib/billing/trial-status", () => ({ liveFeaturesPaused: () => false }));
vi.mock("@/lib/notifications/lead-notify", () => ({ notifyLeadCaptured: vi.fn() }));
vi.mock("@/lib/notifications/create", () => ({ notifyChatbotLeadCaptured: vi.fn() }));
vi.mock("@/lib/chatbot/find-or-create-lead", () => ({ findOrCreateChatbotLead: vi.fn() }));
vi.mock("@/lib/chatbot/send-prospect-profile", () => ({
  sendProspectProfileForConversation: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ withScope: vi.fn(), captureMessage: vi.fn() }));

import { POST as tenantChat } from "@/app/api/chat/route";
import { POST as publicChat } from "@/app/api/public/chatbot/chat/route";

function org(subscriptionStatus: string) {
  return {
    id: "org1",
    slug: "acme",
    orgType: "CLIENT",
    status: "ACTIVE",
    moduleChatbot: true,
    subscriptionStatus,
    tenantSiteConfig: {},
    properties: [],
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

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CHATBOT_ALLOW_ANY_ORIGIN = "true";
  // Month-to-date spend far above the default $200 global cap.
  h.groupBy.mockResolvedValue([
    { provider: "anthropic", _sum: { costMicroCents: 500 * 100_000_000 } },
  ]);
  h.streamText.mockReturnValue({ toTextStreamResponse: () => new Response("hi") });
});

describe.each(routes)("%s under the global spend cap", (path, POST) => {
  it("never blocks a paying org even when the cap is exceeded", async () => {
    h.org.current = org("ACTIVE");
    const res = await POST(req(path));
    expect(res.status).toBe(200);
    expect(h.streamText).toHaveBeenCalledTimes(1);
  });

  it("blocks a non-paying org with 503 when the cap is exceeded", async () => {
    h.org.current = org("TRIALING");
    const res = await POST(req(path));
    expect(res.status).toBe(503);
    expect(h.streamText).not.toHaveBeenCalled();
    expect(h.logUsage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SKIPPED_CAP" }),
    );
  });
});
