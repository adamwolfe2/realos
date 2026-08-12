import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

let mockPrisma: MockPrisma;
const mockRequireScope = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

class ForbiddenErrorStub extends Error {
  status = 403;
}

vi.mock("@/lib/tenancy/scope", () => ({
  requireWritableWorkspace: () => mockRequireScope(),
  ForbiddenError: ForbiddenErrorStub,
  auditPayload: (
    scope: Record<string, unknown>,
    rest: Record<string, unknown>,
  ) => ({ ...scope, ...rest }),
}));

const {
  applyChatbotKnowledgeSuggestion,
  dismissConversationInsight,
  markSiteRecommendationPlanned,
} = await import("@/lib/actions/chatbot-learning-recommendations");

function scope(allowedPropertyIds: string[] | null) {
  return {
    userId: "u1",
    clerkUserId: "clerk_u1",
    orgId: "org-1",
    actualOrgId: "org-1",
    role: "LEASING_AGENT",
    email: "agent@client.test",
    allowedPropertyIds,
  };
}

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockPrisma.$transaction.mockImplementation(async (ops) =>
    typeof ops === "function" ? ops(mockPrisma) : ops,
  );
  mockRequireScope.mockReset();
});

describe("chatbot learning recommendation actions", () => {
  it("constrains recommendation lookup to allowed properties plus org-level rows", async () => {
    mockRequireScope.mockResolvedValue(scope(["prop-a"]));
    mockPrisma.conversationInsight.findFirst.mockResolvedValue(null);

    const result = await dismissConversationInsight({ id: "insight-1" });

    expect(result.ok).toBe(false);
    const where = mockPrisma.conversationInsight.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({
      id: "insight-1",
      orgId: "org-1",
      OR: [{ propertyId: null }, { propertyId: { in: ["prop-a"] } }],
    });
  });

  it("appends approved knowledge to property chatbot config without overwriting existing text", async () => {
    mockRequireScope.mockResolvedValue(scope(["prop-a"]));
    mockPrisma.chatbotKnowledgeSuggestion.findFirst.mockResolvedValue({
      id: "suggestion-1",
      propertyId: "prop-a",
      status: "OPEN",
      patternType: "weak_cta_human_contact_punt",
      suggestedText: "Ask for email or phone after availability questions.",
      affectedCount: 3,
    });
    mockPrisma.propertyChatbotConfig.findUnique.mockResolvedValue({
      chatbotKnowledgeBase: "Existing operator facts.",
    });

    const result = await applyChatbotKnowledgeSuggestion({ id: "suggestion-1" });

    expect(result.ok).toBe(true);
    expect(mockPrisma.propertyChatbotConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { propertyId: "prop-a" },
        update: expect.objectContaining({
          chatbotKnowledgeBase: expect.stringContaining("Existing operator facts."),
        }),
        create: expect.objectContaining({
          orgId: "org-1",
          propertyId: "prop-a",
          chatbotKnowledgeBase: expect.stringContaining("Approved chatbot learning:"),
        }),
      }),
    );
    const update = mockPrisma.propertyChatbotConfig.upsert.mock.calls[0][0].update;
    expect(update.chatbotKnowledgeBase).toContain("Ask for email or phone");
    expect(mockPrisma.chatbotKnowledgeSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "suggestion-1" },
        data: expect.objectContaining({ status: "APPLIED" }),
      }),
    );
  });

  it("marks site recommendations planned through the scoped queue path", async () => {
    mockRequireScope.mockResolvedValue(scope(null));
    mockPrisma.siteImprovementRecommendation.findFirst.mockResolvedValue({
      id: "site-1",
      propertyId: null,
      status: "OPEN",
    });

    const result = await markSiteRecommendationPlanned({ id: "site-1" });

    expect(result.ok).toBe(true);
    expect(mockPrisma.siteImprovementRecommendation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "site-1" },
        data: expect.objectContaining({ status: "APPLIED" }),
      }),
    );
  });
});
