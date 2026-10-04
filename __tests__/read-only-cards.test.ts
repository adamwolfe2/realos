import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Read-only seats see insight cards and AI follow-up drafts without the
// action controls. Display only; server actions enforce the same role set.

vi.mock("@/app/portal/insights/actions", () => ({
  acknowledgeInsight: vi.fn(),
  dismissInsight: vi.fn(),
  snoozeInsight: vi.fn(),
  markActed: vi.fn(),
}));
vi.mock("@/lib/actions/lead-follow-up-tasks", () => ({
  sendLeadFollowUpDraft: vi.fn(),
  updateLeadFollowUpTaskStatus: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { InsightCard } = await import("@/components/portal/insights/insight-card");
const { AiFollowUpTaskCard } = await import(
  "@/components/portal/leads/ai-follow-up-task-card"
);

const insight = {
  id: "i1",
  kind: "k",
  category: "leads",
  severity: "info",
  status: "open",
  title: "Title",
  body: "Body",
  createdAt: new Date(),
};
const task = {
  id: "t1",
  taskType: "INVITE_TO_TOUR",
  priority: 1,
  status: "OPEN",
  dueAt: null,
  recommendedChannel: "EMAIL",
  reasonSummary: "why",
  drafts: [{ id: "d1", channel: "EMAIL" as const, subject: "Hi", body: "Hello" }],
  learningCase: null,
};

describe("read-only cards", () => {
  it("InsightCard hides lifecycle actions when readOnly", () => {
    expect(renderToStaticMarkup(createElement(InsightCard, { insight }))).toContain(
      "Dismiss",
    );
    const html = renderToStaticMarkup(
      createElement(InsightCard, { insight, readOnly: true }),
    );
    expect(html).not.toContain("Dismiss");
    expect(html).not.toContain("Acknowledge");
    expect(html).toContain("Title");
  });

  it("AiFollowUpTaskCard hides send/triage controls when readOnly", () => {
    expect(
      renderToStaticMarkup(createElement(AiFollowUpTaskCard, { task })),
    ).toContain("Send draft");
    const html = renderToStaticMarkup(
      createElement(AiFollowUpTaskCard, { task, readOnly: true }),
    );
    expect(html).not.toContain("Send draft");
    expect(html).not.toContain("Approve");
    expect(html).toContain("Hello");
    expect(html).toContain("readOnly");
  });
});
