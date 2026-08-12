import { describe, expect, it } from "vitest";
import {
  createLearningRunPlan,
  type LearningConversation,
} from "@/lib/chatbot/learning/engine";

const NOW = new Date("2026-08-11T20:00:00.000Z");

function conversation(
  patch: Partial<LearningConversation> = {},
): LearningConversation {
  return {
    id: "conv_1",
    orgId: "org_1",
    propertyId: "prop_1",
    leadId: "lead_1",
    capturedEmail: "prospect@example.com",
    capturedPhone: null,
    messageCount: 5,
    lastMessageAt: new Date("2026-08-09T12:00:00.000Z"),
    messages: [
      { role: "user", content: "How much is a single room for fall?" },
      {
        role: "assistant",
        content: "Please contact the leasing office for current pricing.",
      },
    ],
    prospectProfile: {
      sentiment: "warm",
      roomType: "single room",
      moveInDate: "August / fall",
      budgetMonthly: "$995",
      followUpNeeded: "Send current availability and pricing options.",
    },
    property: {
      id: "prop_1",
      name: "Telegraph Commons",
      websiteUrl: "https://telegraphcommons.com",
      virtualTourUrl: "https://telegraphcommons.com/tour",
      notifyLeadEmailOverride: "leasing@telegraphcommons.com",
      chatbotConfig: {
        primaryCtaText: "Schedule a tour",
        primaryCtaUrl: "https://telegraphcommons.com/contact#tour",
        phoneNumber: "(510) 462-5442",
        contactEmail: "hello@telegraphcommons.com",
      },
    },
    lead: {
      id: "lead_1",
      status: "NEW",
      source: "CHATBOT",
      intent: "warm",
      firstName: "Taylor",
      email: "prospect@example.com",
      phone: null,
      lastActivityAt: new Date("2026-08-08T12:00:00.000Z"),
      lastEmailSentAt: null,
      emailsSent: 0,
      tours: [],
      applications: [],
      residents: [],
    },
    ...patch,
  };
}

describe("chatbot learning engine", () => {
  it("creates a follow-up task and grounded draft for warm NEW chatbot leads", () => {
    const plan = createLearningRunPlan([conversation()], NOW);

    expect(plan.cases.some((c) => c.caseType === "STALLED_LEAD")).toBe(true);
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0]).toMatchObject({
      taskType: "SEND_AVAILABILITY_PRICING",
      recommendedChannel: "EMAIL",
      priority: 1,
      leadId: "lead_1",
    });
    expect(plan.tasks[0]?.draft.body).toContain("Taylor");
    expect(plan.tasks[0]?.draft.body).toContain("Telegraph Commons");
    expect(plan.tasks[0]?.draft.body).toContain(
      "https://telegraphcommons.com/contact#tour",
    );
    expect(plan.tasks[0]?.draft.body).toContain("(510) 462-5442");
    expect(plan.tasks[0]?.draft.body).toContain("Availability can change");
    expect(plan.tasks[0]?.draft.generatedFrom).toMatchObject({
      property: {
        name: "Telegraph Commons",
        primaryCtaUrl: "https://telegraphcommons.com/contact#tour",
      },
    });
    expect(plan.tasks[0]?.draft.complianceWarnings.join(" ")).toContain(
      "invented pricing",
    );
  });

  it("adds property tour links to visit-intent follow-up drafts", () => {
    const plan = createLearningRunPlan(
      [
        conversation({
          prospectProfile: {
            sentiment: "warm",
            roomType: "private room",
            moveInDate: "fall",
            followUpNeeded: "Invite the prospect to tour.",
          },
          messages: [
            { role: "user", content: "Can I schedule a tour this week?" },
            {
              role: "assistant",
              content: "Reach out to leasing to schedule a visit.",
            },
          ],
        }),
      ],
      NOW,
    );

    expect(plan.tasks[0]?.taskType).toBe("INVITE_TO_TOUR");
    expect(plan.tasks[0]?.draft.subject).toBe("Want to visit Telegraph Commons?");
    expect(plan.tasks[0]?.draft.body).toContain("https://telegraphcommons.com/tour");
  });

  it("turns uncaptured mid-depth pricing conversations into knowledge and site recommendations", () => {
    const rows = Array.from({ length: 3 }, (_, index) =>
      conversation({
        id: `conv_uncaptured_${index}`,
        leadId: null,
        capturedEmail: null,
        capturedPhone: null,
        lead: null,
        messageCount: 4,
      }),
    );

    const plan = createLearningRunPlan(rows, NOW);

    expect(plan.tasks).toHaveLength(0);
    expect(
      plan.cases.filter((c) => c.caseType === "PRICING_QUESTION_NO_CAPTURE"),
    ).toHaveLength(3);
    expect(plan.knowledgeSuggestions.length).toBeGreaterThan(0);
    expect(
      plan.conversationInsights.some(
        (insight) => insight.insightType === "SITE_CONTENT_GAP",
      ),
    ).toBe(true);
    expect(
      plan.siteRecommendations.some(
        (rec) => rec.recommendationType === "AVAILABILITY_COPY",
      ),
    ).toBe(true);
  });

  it("does not create lead tasks for conversations without reachable contact", () => {
    const plan = createLearningRunPlan(
      [
        conversation({
          leadId: null,
          capturedEmail: null,
          capturedPhone: null,
          lead: null,
        }),
      ],
      NOW,
    );

    expect(plan.tasks).toHaveLength(0);
  });
});
