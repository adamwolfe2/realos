import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// The main paying customer's shape: ONE ACTIVE property plus many EXCLUDED
// address-only AppFolio rows, embed without data-property, page URL matching
// nothing. Every capture entry point must use the single live property (its
// listings, address, rent) and never an EXCLUDED row, never "no property".
// The EXCLUDED rows are deliberately the most recently updated, so a query
// that forgets the ACTIVE filter puts one of them at properties[0].
// ---------------------------------------------------------------------------

const LIVE = {
  id: "prop_tc",
  slug: "telegraph-commons",
  name: "Telegraph Commons",
  lifecycle: "ACTIVE",
  addressLine1: "2490 Channing Way",
  city: "Berkeley",
  state: "CA",
  postalCode: "94704",
  residentialSubtype: "STUDENT_HOUSING",
  propertyType: "RESIDENTIAL",
  totalUnits: 10,
  yearBuilt: 1960,
  websiteUrl: null,
  listings: [
    {
      unitType: "Single Suite",
      bedrooms: 1,
      bathrooms: 1,
      squareFeet: 200,
      priceCents: 165000,
      unitNumber: null,
      isAvailable: true,
      availableFrom: new Date("2027-08-01"),
    },
  ],
};
const excluded = (n: number) => ({
  ...LIVE,
  id: `prop_x${n}`,
  slug: `addr-${n}`,
  name: `Excluded Address ${n}`,
  lifecycle: "EXCLUDED",
  addressLine1: `${n} Ghost St`,
  totalUnits: 50,
  listings: [{ ...LIVE.listings[0], unitType: "Ghost Unit", priceCents: 40000 }],
});
// Most-recently-updated first, like orderBy: { updatedAt: "desc" }.
const ALL = [excluded(1), excluded(2), excluded(3), LIVE];

type Where = { lifecycle?: { in?: string[] } } | undefined;
function filterProps(where: Where) {
  const allowed = where?.lifecycle?.in;
  return allowed ? ALL.filter((p) => allowed.includes(p.lifecycle)) : ALL;
}

const h = vi.hoisted(() => ({
  streamText: vi.fn(),
  generateText: vi.fn(),
  resolveChatbotConfig: vi.fn(),
  kbFindFirst: vi.fn(async () => null),
}));

const ORG = {
  id: "org_sg",
  slug: "sg-real-estate",
  name: "SG Real Estate",
  orgType: "CLIENT",
  status: "ACTIVE",
  moduleChatbot: true,
  subscriptionStatus: "ACTIVE",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  primaryContactName: null,
  tenantSiteConfig: { chatbotEnabled: true, chatbotPersonaName: "Riley" },
};

vi.mock("ai", () => ({ streamText: h.streamText, generateText: h.generateText }));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: (m: string) => m }));
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(
        async (args: { include?: { properties?: { where?: Where } }; select?: { properties?: { where?: Where } } }) => ({
          ...ORG,
          properties: filterProps((args.include ?? args.select)?.properties?.where),
        }),
      ),
    },
    chatbotConversation: { findFirst: vi.fn(async () => null) },
    propertyKnowledgeBase: { findFirst: h.kbFindFirst },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  publicApiLimiter: {},
  clientWriteLimiter: {},
  chatbotConfigLimiter: {},
  WIDGET_FALLBACK: { publicApi: {}, chatbotConfig: {} },
  checkRateLimit: async () => ({ allowed: true }),
  getIp: () => "1.2.3.4",
  rateLimited: () => new Response("rate", { status: 429 }),
}));
vi.mock("@/lib/ai/quota", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/quota")>()),
  checkAiQuota: async () => ({ allowed: true, count: 0, limit: 1 }),
}));
vi.mock("@/lib/cost-tracker/cap", () => ({
  withSpendCap: async (_o: unknown, fn: () => Promise<unknown>) => ({ status: "ok", data: await fn() }),
  secondsUntilCapReset: () => 60,
}));
vi.mock("@/lib/chatbot/log-chat-usage", () => ({ logChatUsage: vi.fn() }));
vi.mock("@/lib/tenancy/origin-guard", () => ({
  requireMatchingOrigin: async () => ({ ok: true, hostname: "x" }),
  chatbotOriginBypassEnabled: () => false,
}));
vi.mock("@/lib/tenancy/scope", async (orig) => ({
  ...(await orig<typeof import("@/lib/tenancy/scope")>()),
  requireScope: async () => ({ orgId: "org_sg", allowedPropertyIds: null, role: "CLIENT_ADMIN" }),
}));
vi.mock("@/lib/chatbot/resolve-config", () => ({
  resolveChatbotConfig: h.resolveChatbotConfig,
}));
vi.mock("@/lib/billing/trial-status", async (orig) => ({
  ...(await orig<typeof import("@/lib/billing/trial-status")>()),
  liveFeaturesPaused: () => false,
}));
vi.mock("@/lib/sentry", () => ({ captureWithContext: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ withScope: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/notifications/lead-notify", () => ({ notifyLeadCaptured: vi.fn() }));
vi.mock("@/lib/notifications/create", () => ({ notifyChatbotLeadCaptured: vi.fn() }));
vi.mock("@/lib/chatbot/find-or-create-lead", () => ({ findOrCreateChatbotLead: vi.fn() }));
vi.mock("@/lib/chatbot/send-prospect-profile", () => ({
  sendProspectProfileForConversation: vi.fn(),
}));

const publicChat = (await import("@/app/api/public/chatbot/chat/route")).POST;
const tenantChat = (await import("@/app/api/chat/route")).POST;
const previewChat = (await import("@/app/api/portal/chatbot/preview-chat/route")).POST;
const listingsSummary = (await import("@/app/api/public/chatbot/listings-summary/route")).GET;

const PAGE = "https://sgre-portfolio.test/";
const MESSAGES = [{ role: "user", content: "what do you have?" }];

function post(path: string, body: unknown) {
  return new NextRequest(`https://app.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function expectLivePropertyPrompt(system: string) {
  expect(system).toContain("Telegraph Commons");
  expect(system).toContain("2490 Channing Way");
  expect(system).toContain("Single Suite");
  expect(system).not.toContain("Excluded Address");
  expect(system).not.toContain("Ghost");
}

beforeEach(() => {
  vi.clearAllMocks();
  h.resolveChatbotConfig.mockResolvedValue({
    chatbotEnabled: true,
    chatbotPersonaName: "Riley",
    chatbotKnowledgeBase: null,
    chatbotGreeting: null,
    chatbotCaptureMode: "IN_CHAT",
    phoneNumber: null,
    contactEmail: null,
    primaryCtaUrl: null,
    primaryCtaText: null,
  });
  h.streamText.mockReturnValue({ toTextStreamResponse: () => new Response("ok") });
  h.generateText.mockResolvedValue({ text: "ok", totalUsage: {} });
});

describe("one ACTIVE property + EXCLUDED rows, no data-property, unmatched page", () => {
  it("public widget chat grounds the prompt in the live property", async () => {
    const res = await publicChat(
      post("/api/public/chatbot/chat", {
        slug: "sg-real-estate",
        sessionId: "11111111-1111-4111-8111-111111111111",
        messages: MESSAGES,
        pageUrl: PAGE,
      }),
    );
    expect(res.status).toBe(200);
    expectLivePropertyPrompt(h.streamText.mock.calls[0][0].system);
    expect(h.resolveChatbotConfig).toHaveBeenCalledWith("org_sg", "prop_tc");
  });

  it("tenant /api/chat grounds the prompt in the live property", async () => {
    const res = await tenantChat(
      post("/api/chat", {
        orgId: "org_sg",
        sessionId: "11111111-1111-4111-8111-111111111111",
        messages: MESSAGES,
        pageUrl: PAGE,
      }),
    );
    expect(res.status).toBe(200);
    expectLivePropertyPrompt(h.streamText.mock.calls[0][0].system);
  });

  it("operator preview chat grounds the prompt in the live property", async () => {
    const res = await previewChat(
      post("/api/portal/chatbot/preview-chat", { messages: MESSAGES, draft: {} }),
    );
    expect(res.status).toBe(200);
    expectLivePropertyPrompt(h.generateText.mock.calls[0][0].system);
    expect(h.resolveChatbotConfig).toHaveBeenCalledWith("org_sg", "prop_tc");
  });

  it("listings greeting shows the live property's units and rent", async () => {
    const res = await listingsSummary(
      new NextRequest("https://app.test/api/public/chatbot/listings-summary?slug=sg-real-estate"),
    );
    const json = await res.json();
    expect(json).toEqual({
      openCount: 1,
      lowestRent: 1650,
      nextAvailable: new Date("2027-08-01").toISOString(),
    });
  });
});
