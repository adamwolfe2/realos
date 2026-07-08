import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Onboarding false-positive fix: "chatbot_configured" only proves DB config
// exists (chatbotEnabled=true). It does NOT prove the operator pasted the
// embed snippet (public/embed/chatbot.js) onto their live site, so the
// checklist could show the bot "done" while it never rendered for a real
// visitor. This mirrors the pixel_installed vs pixel_firing split: we add a
// separate "chatbot_firing" item that requires real evidence the widget
// executed on the live site — a ChatbotConversation for THIS property inside
// the same 14-day freshness window used for pixel_firing.
// ---------------------------------------------------------------------------

// Mock fns typed to resolve `any` so each test can hand back a bespoke row
// shape via mockResolvedValue without fighting inferred `null` return types.
const h = vi.hoisted(() => {
  const fn = () => vi.fn(async (): Promise<any> => null);
  return {
    property: { findFirst: fn() },
    cursiveIntegration: { findFirst: fn() },
    seoIntegration: { findMany: fn() },
    adCampaign: { findFirst: fn() },
    propertyChatbotConfig: { findUnique: fn() },
    popupCampaign: { findFirst: fn() },
    chatbotConversation: { findFirst: fn() },
  };
});

vi.mock("@/lib/db", () => ({ prisma: h }));

import { getLaunchChecklist } from "@/lib/properties/launch";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

function propertyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "prop_1",
    slug: "telegraph",
    heroImageUrl: "https://sg.example/hero.jpg",
    metaTitle: "Telegraph Commons",
    metaDescription: null,
    description: "Student housing near campus.",
    launchStatus: "ONBOARDING",
    launchStatusSetBy: "AUTO",
    // Only the chatbot module is on so the checklist stays focused on the
    // two chatbot items under test.
    org: {
      moduleChatbot: true,
      modulePixel: false,
      moduleSEO: false,
      moduleGoogleAds: false,
      moduleMetaAds: false,
      modulePopups: false,
    },
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  h.property.findFirst.mockReset().mockResolvedValue(propertyRow());
  h.cursiveIntegration.findFirst.mockReset().mockResolvedValue(null);
  h.seoIntegration.findMany.mockReset().mockResolvedValue([]);
  h.adCampaign.findFirst.mockReset().mockResolvedValue(null);
  h.propertyChatbotConfig.findUnique.mockReset().mockResolvedValue(null);
  h.popupCampaign.findFirst.mockReset().mockResolvedValue(null);
  h.chatbotConversation.findFirst.mockReset().mockResolvedValue(null);
});

const itemsByKey = async () => {
  const checklist = await getLaunchChecklist("org_1", "prop_1");
  const map: Record<string, any> = {};
  for (const i of checklist!.items) map[i.key] = i;
  return map;
};

describe("launch checklist: chatbot_firing (embed actually live)", () => {
  it("adds a chatbot_firing item distinct from chatbot_configured", async () => {
    h.propertyChatbotConfig.findUnique.mockResolvedValue({
      chatbotEnabled: true,
      chatbotKnowledgeBase: "Telegraph facts",
    });
    const items = await itemsByKey();
    expect(items.chatbot_configured).toBeDefined();
    expect(items.chatbot_firing).toBeDefined();
    // It's a launch-blocking step, mirroring pixel_firing.
    expect(items.chatbot_firing.required).toBe(true);
  });

  it("is DONE only when a conversation fired for this property inside the window", async () => {
    h.propertyChatbotConfig.findUnique.mockResolvedValue({
      chatbotEnabled: true,
      chatbotKnowledgeBase: "Telegraph facts",
    });
    h.chatbotConversation.findFirst.mockResolvedValue({
      lastMessageAt: daysAgo(1),
    });
    const items = await itemsByKey();
    expect(items.chatbot_configured.done).toBe(true);
    expect(items.chatbot_firing.done).toBe(true);
  });

  it("is NOT done when configured but the embed never produced a conversation", async () => {
    // The exact false positive: DB says enabled, but nobody ever chatted →
    // no evidence the snippet is on the live site.
    h.propertyChatbotConfig.findUnique.mockResolvedValue({
      chatbotEnabled: true,
      chatbotKnowledgeBase: "Telegraph facts",
    });
    h.chatbotConversation.findFirst.mockResolvedValue(null);
    const items = await itemsByKey();
    expect(items.chatbot_configured.done).toBe(true);
    expect(items.chatbot_firing.done).toBe(false);
  });

  it("is NOT done when the last conversation is older than the freshness window", async () => {
    h.propertyChatbotConfig.findUnique.mockResolvedValue({
      chatbotEnabled: true,
      chatbotKnowledgeBase: "Telegraph facts",
    });
    h.chatbotConversation.findFirst.mockResolvedValue({
      lastMessageAt: daysAgo(30),
    });
    const items = await itemsByKey();
    expect(items.chatbot_firing.done).toBe(false);
  });

  it("scopes the firing evidence strictly to THIS property (no null/org-wide leak)", async () => {
    h.propertyChatbotConfig.findUnique.mockResolvedValue({
      chatbotEnabled: true,
      chatbotKnowledgeBase: null,
    });
    await getLaunchChecklist("org_1", "prop_1");
    const where = (h.chatbotConversation.findFirst.mock.calls.at(-1) as any[])[0]
      .where;
    expect(where.orgId).toBe("org_1");
    expect(where.propertyId).toBe("prop_1");
  });

  it("omits both chatbot items when the workspace has no chatbot module", async () => {
    h.property.findFirst.mockResolvedValue(
      propertyRow({
        org: {
          moduleChatbot: false,
          modulePixel: false,
          moduleSEO: false,
          moduleGoogleAds: false,
          moduleMetaAds: false,
          modulePopups: false,
        },
      }),
    );
    const items = await itemsByKey();
    expect(items.chatbot_configured).toBeUndefined();
    expect(items.chatbot_firing).toBeUndefined();
  });
});
