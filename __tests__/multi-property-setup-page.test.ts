import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Multi-property: /portal/setup is per property. Before: step 3 ("Turn on
// your chatbot") read the org-level TenantSiteConfig and the org's latest
// conversation, so selecting property B showed "Installed on your site" and
// "B is live" because property A's widget was getting chats. After: it reads
// B's effective chatbot config (B override ?? org) and only B's conversations.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  property: { findMany: vi.fn() },
  organization: { findUnique: vi.fn() },
  chatbotConversation: { findFirst: vi.fn() },
  resolveChatbotConfig: vi.fn(),
  getConnectStatusForOrg: vi.fn(async () => []),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    property: h.property,
    organization: h.organization,
    chatbotConversation: h.chatbotConversation,
  },
}));
vi.mock("@/lib/tenancy/scope", () => ({
  requireScope: async () => ({ orgId: "org-1", allowedPropertyIds: null }),
}));
vi.mock("@/lib/connect/status", () => ({
  getConnectStatusForOrg: h.getConnectStatusForOrg,
}));
vi.mock("@/lib/connect/provider-availability", () => ({
  getProviderAvailability: () => ({
    google_ads: { available: false },
    meta_ads: { available: false },
  }),
}));
vi.mock("@/lib/portal/active-property", () => ({
  getActivePropertyId: async () => "prop-b",
}));
vi.mock("@/lib/chatbot/resolve-config", () => ({
  resolveChatbotConfig: h.resolveChatbotConfig,
}));
vi.mock("@/components/portal/overview/kit", () => ({
  Initial: () => null,
  Panel: () => null,
  Pill: () => null,
  Step: () => null,
}));
vi.mock("@/app/portal/setup/connect-steps", () => ({ ConnectSteps: () => null }));

const { default: SetupPage } = await import("@/app/portal/setup/page");

beforeEach(() => {
  h.property.findMany.mockResolvedValue([
    { id: "prop-a", name: "A", city: null, state: null, websiteUrl: null },
    { id: "prop-b", name: "B", city: null, state: null, websiteUrl: null },
  ]);
  h.organization.findUnique.mockResolvedValue({
    name: "Org",
    notifyLeadEmail: null,
    notifyOnChatbotLead: false,
    moduleChatbot: true,
  });
  h.chatbotConversation.findFirst.mockResolvedValue(null);
  h.resolveChatbotConfig.mockResolvedValue({
    chatbotPersonaName: null,
    chatbotGreeting: null,
    chatbotKnowledgeBase: null,
  });
});

describe("setup page chatbot step is scoped to the selected property", () => {
  it("reads property B's conversations and B's effective chatbot config", async () => {
    await SetupPage({ searchParams: Promise.resolve({}) });
    const where = (h.chatbotConversation.findFirst.mock.calls[0] as any[])[0].where;
    expect(where).toEqual({ orgId: "org-1", propertyId: "prop-b" });
    expect(h.resolveChatbotConfig).toHaveBeenCalledWith("org-1", "prop-b");
    expect(h.getConnectStatusForOrg).toHaveBeenCalledWith("org-1", "prop-b");
  });

  it("follows ?property= over the cookie", async () => {
    await SetupPage({ searchParams: Promise.resolve({ property: "prop-a" }) });
    const where = (h.chatbotConversation.findFirst.mock.calls.at(-1) as any[])[0].where;
    expect(where.propertyId).toBe("prop-a");
    expect(h.resolveChatbotConfig).toHaveBeenLastCalledWith("org-1", "prop-a");
  });
});
