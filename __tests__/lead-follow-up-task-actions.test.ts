import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

let mockPrisma: MockPrisma;
const mockRequireScope = vi.fn();
const mockSendLeadEmail = vi.fn();
const mockSendLeadSms = vi.fn();

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

vi.mock("@/lib/actions/lead-email", () => ({
  sendLeadEmail: (input: unknown) => mockSendLeadEmail(input),
}));

vi.mock("@/lib/actions/lead-sms", () => ({
  sendLeadSms: (input: unknown) => mockSendLeadSms(input),
}));

const { sendLeadFollowUpDraft, updateLeadFollowUpTaskStatus } = await import(
  "@/lib/actions/lead-follow-up-tasks"
);

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

function task() {
  return {
    id: "task-1",
    orgId: "org-1",
    propertyId: "prop-a",
    leadId: "lead-1",
    status: "OPEN",
    dueAt: null,
    drafts: [
      {
        id: "draft-1",
        status: "DRAFT",
        channel: "EMAIL",
        subject: "Follow-up",
        body: "Hi Taylor, quick follow-up.",
      },
    ],
    lead: { id: "lead-1" },
  };
}

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockPrisma.$transaction.mockImplementation(async (ops) => ops);
  mockRequireScope.mockReset();
  mockSendLeadEmail.mockReset();
  mockSendLeadSms.mockReset();
});

describe("lead follow-up task actions", () => {
  it("constrains task lookup to the caller's property scope", async () => {
    mockRequireScope.mockResolvedValue(scope(["prop-a"]));
    mockPrisma.leadFollowUpTask.findFirst.mockResolvedValue(null);

    const result = await updateLeadFollowUpTaskStatus({
      taskId: "task-out-of-scope",
      action: "approve",
    });

    expect(result.ok).toBe(false);
    const where = mockPrisma.leadFollowUpTask.findFirst.mock.calls[0][0].where;
    expect(where.orgId).toBe("org-1");
    expect(where.propertyId).toBe("prop-a");
    expect(mockPrisma.leadFollowUpTask.update).not.toHaveBeenCalled();
  });

  it("does not mark a draft sent when email transport fails", async () => {
    mockRequireScope.mockResolvedValue(scope(null));
    mockPrisma.leadFollowUpTask.findFirst.mockResolvedValue(task());
    mockSendLeadEmail.mockResolvedValue({ ok: false, error: "transport failed" });

    const result = await sendLeadFollowUpDraft({
      taskId: "task-1",
      draftId: "draft-1",
      subject: "Follow-up",
      body: "Hi Taylor, quick follow-up.",
    });

    expect(result).toEqual({ ok: false, error: "transport failed" });
    expect(mockPrisma.leadFollowUpDraft.update).not.toHaveBeenCalled();
    expect(mockPrisma.leadFollowUpTask.update).not.toHaveBeenCalled();
  });

  it("sends AI email drafts without adding a second greeting", async () => {
    mockRequireScope.mockResolvedValue(scope(null));
    mockPrisma.leadFollowUpTask.findFirst.mockResolvedValue(task());
    mockSendLeadEmail.mockResolvedValue({ ok: true, messageId: "msg-1" });

    const result = await sendLeadFollowUpDraft({
      taskId: "task-1",
      draftId: "draft-1",
      subject: "Follow-up",
      body: "Hi Taylor, quick follow-up.",
    });

    expect(result.ok).toBe(true);
    expect(mockSendLeadEmail).toHaveBeenCalledWith({
      leadId: "lead-1",
      subject: "Follow-up",
      body: "Hi Taylor, quick follow-up.",
      skipAutoGreeting: true,
    });
    expect(mockPrisma.leadFollowUpDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "draft-1" },
        data: expect.objectContaining({ status: "SENT" }),
      }),
    );
    expect(mockPrisma.leadFollowUpTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1" },
        data: expect.objectContaining({ status: "SENT" }),
      }),
    );
  });
});
