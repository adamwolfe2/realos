import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: {
    leadFollowUpTask: { count: vi.fn(), findMany: vi.fn() },
    conversationInsight: { count: vi.fn(), findMany: vi.fn() },
    chatbotKnowledgeSuggestion: { count: vi.fn(), findMany: vi.fn() },
    siteImprovementRecommendation: { count: vi.fn(), findMany: vi.fn() },
    cronRun: { findFirst: vi.fn() },
  },
  revalidatePath: vi.fn(),
  requireWritableWorkspace: vi.fn(),
  effectivePropertyIds: vi.fn(),
  runChatbotLearningLoop: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/tenancy/scope", () => ({
  ForbiddenError: class ForbiddenError extends Error {},
  requireWritableWorkspace: h.requireWritableWorkspace,
}));
vi.mock("@/lib/tenancy/property-filter", () => ({
  effectivePropertyIds: h.effectivePropertyIds,
}));
vi.mock("@/lib/chatbot/learning/run", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chatbot/learning/run")>()),
  runChatbotLearningLoop: h.runChatbotLearningLoop,
}));

import { loadChatbotLearningSummary } from "@/lib/chatbot/learning/run";
import { runConversationLearningAction } from "@/app/portal/conversations/insights/actions";

describe("chatbot learning client polish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T20:00:00.000Z"));
    h.db.leadFollowUpTask.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4);
    h.db.conversationInsight.count.mockResolvedValue(5);
    h.db.chatbotKnowledgeSuggestion.count.mockResolvedValue(6);
    h.db.siteImprovementRecommendation.count.mockResolvedValue(7);
    h.db.leadFollowUpTask.findMany.mockResolvedValue([]);
    h.db.conversationInsight.findMany.mockResolvedValue([]);
    h.db.chatbotKnowledgeSuggestion.findMany.mockResolvedValue([]);
    h.db.siteImprovementRecommendation.findMany.mockResolvedValue([]);
    h.db.cronRun.findFirst.mockResolvedValue({
      id: "cron_1",
      status: "ok",
      startedAt: new Date("2026-08-11T05:17:00.000Z"),
      finishedAt: new Date("2026-08-11T05:17:03.000Z"),
      recordsProcessed: 12,
      durationMs: 3000,
    });
  });

  it("returns task urgency counts and the latest automated learning run", async () => {
    const summary = await loadChatbotLearningSummary({
      orgId: "org_1",
      propertyIds: ["prop_1"],
    });

    expect(summary.counts).toMatchObject({
      openTasks: 8,
      highPriorityTasks: 3,
      overdueTasks: 2,
      dueTodayTasks: 4,
      openInsights: 5,
      openKnowledgeSuggestions: 6,
      openSiteRecommendations: 7,
    });
    expect(summary.latestRun).toMatchObject({
      id: "cron_1",
      status: "ok",
      recordsProcessed: 12,
    });
    expect(h.db.leadFollowUpTask.count.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          dueAt: { lt: expect.any(Date) },
        }),
      }),
    );
    expect(h.db.leadFollowUpTask.count.mock.calls[3]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          dueAt: { gte: expect.any(Date), lt: expect.any(Date) },
        }),
      }),
    );
    expect(h.db.cronRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobName: "chatbot-learning-loop" },
      }),
    );
  });

  it("reports scanned conversations and every persisted learning artifact after a manual run", async () => {
    h.requireWritableWorkspace.mockResolvedValue({ orgId: "org_1" });
    h.effectivePropertyIds.mockReturnValue(["prop_1"]);
    h.runChatbotLearningLoop.mockResolvedValue({
      scannedConversations: 211,
      persisted: {
        tasks: 9,
        knowledgeSuggestions: 2,
        conversationInsights: 4,
        siteRecommendations: 3,
      },
    });

    const result = await runConversationLearningAction();

    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.message).toContain("Scanned 211 conversations");
    expect(result.ok && result.message).toContain("2 knowledge fixes");
    expect(h.runChatbotLearningLoop).toHaveBeenCalledWith({
      orgId: "org_1",
      propertyIds: ["prop_1"],
      dryRun: false,
      take: 1000,
    });
  });
});
