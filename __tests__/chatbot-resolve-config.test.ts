import { describe, it, expect } from "vitest";
import { ChatbotCaptureMode } from "@prisma/client";
import { mergeChatbotConfig } from "@/lib/chatbot/resolve-config";

// Minimal builders — only the fields mergeChatbotConfig reads. Cast through
// unknown so we don't have to construct full Prisma rows (timestamps, ids).
function org(overrides: Record<string, unknown> = {}) {
  return {
    chatbotEnabled: true,
    chatbotPersonaName: "Org Persona",
    chatbotGreeting: "Org greeting",
    chatbotFollowUpMessage: null,
    chatbotTeaserText: "Org teaser",
    chatbotBrandColor: "#000000",
    chatbotAvatarUrl: null,
    chatbotCaptureMode: ChatbotCaptureMode.ON_INTENT,
    chatbotKnowledgeBase: "Org KB",
    chatbotIdleTriggerSeconds: 5,
    primaryCtaText: "Apply",
    primaryCtaUrl: "https://org.example/apply",
    phoneNumber: "555-ORG",
    contactEmail: "org@example.com",
    ga4MeasurementId: "G-ORG",
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function prop(overrides: Record<string, unknown> = {}) {
  // A property override row: every field null by default = inherit.
  return {
    chatbotEnabled: null,
    chatbotPersonaName: null,
    chatbotGreeting: null,
    chatbotFollowUpMessage: null,
    chatbotTeaserText: null,
    chatbotBrandColor: null,
    chatbotAvatarUrl: null,
    chatbotCaptureMode: null,
    chatbotKnowledgeBase: null,
    chatbotIdleTriggerSeconds: null,
    primaryCtaText: null,
    primaryCtaUrl: null,
    phoneNumber: null,
    contactEmail: null,
    ga4MeasurementId: null,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("mergeChatbotConfig", () => {
  it("returns org values when there is no property override", () => {
    const r = mergeChatbotConfig(org(), null);
    expect(r.source).toBe("org");
    expect(r.chatbotEnabled).toBe(true);
    expect(r.chatbotPersonaName).toBe("Org Persona");
    expect(r.chatbotKnowledgeBase).toBe("Org KB");
  });

  it("property non-null fields override org; null fields inherit", () => {
    const r = mergeChatbotConfig(
      org(),
      prop({
        chatbotPersonaName: "Telegraph Bot",
        chatbotKnowledgeBase: "Telegraph KB",
      }),
    );
    expect(r.source).toBe("property");
    // overridden
    expect(r.chatbotPersonaName).toBe("Telegraph Bot");
    expect(r.chatbotKnowledgeBase).toBe("Telegraph KB");
    // inherited (property field was null)
    expect(r.chatbotGreeting).toBe("Org greeting");
    expect(r.phoneNumber).toBe("555-ORG");
  });

  it("property chatbotEnabled=false overrides an enabled org", () => {
    const r = mergeChatbotConfig(org({ chatbotEnabled: true }), prop({ chatbotEnabled: false }));
    expect(r.chatbotEnabled).toBe(false);
  });

  it("property chatbotEnabled=true overrides a disabled org", () => {
    const r = mergeChatbotConfig(org({ chatbotEnabled: false }), prop({ chatbotEnabled: true }));
    expect(r.chatbotEnabled).toBe(true);
  });

  it("property chatbotEnabled=null inherits the org toggle", () => {
    expect(mergeChatbotConfig(org({ chatbotEnabled: true }), prop()).chatbotEnabled).toBe(true);
    expect(mergeChatbotConfig(org({ chatbotEnabled: false }), prop()).chatbotEnabled).toBe(false);
  });

  it("falls back to safe defaults when neither config exists", () => {
    const r = mergeChatbotConfig(null, null);
    expect(r.source).toBe("none");
    expect(r.chatbotEnabled).toBe(false);
    expect(r.chatbotCaptureMode).toBe(ChatbotCaptureMode.ON_INTENT);
    expect(r.chatbotIdleTriggerSeconds).toBe(5);
    expect(r.chatbotKnowledgeBase).toBeNull();
  });
});
