import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// The funnel-lead-sync cron's at-most-once guarantee: funnelPushedAt is stamped
// BEFORE the push fires. Funnel's POST /clients creates a new Prospect on every
// call (no upsert), so stamping first means a crash mid-push can never
// re-create a duplicate in the client's CRM on the next run.
//
// pushConversationLeadToFunnel is fully mocked here (its own full-transcript
// behavior is covered in funnel-idle-sync.test.ts) so this test isolates the
// cron's ordering + queue semantics.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  push: vi.fn(),
  order: [] as string[],
  db: {
    funnelIntegration: { findMany: vi.fn() },
    chatbotConversation: { findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/cron/auth", () => ({ verifyCronAuth: () => null }));
vi.mock("@/lib/health/cron-run", () => ({
  // Pass-through: invoke the job, hand back its NextResponse.
  recordCronRun: async (
    _name: string,
    job: () => Promise<{ result: unknown }>,
  ) => (await job()).result,
}));
vi.mock("@/lib/integrations/funnel-client", () => ({
  pushConversationLeadToFunnel: h.push,
}));

import { GET } from "@/app/api/cron/funnel-lead-sync/route";

beforeEach(() => {
  vi.clearAllMocks();
  h.order.length = 0;
  h.db.funnelIntegration.findMany.mockResolvedValue([{ orgId: "org_1" }]);
  h.db.chatbotConversation.findMany.mockResolvedValue([
    { id: "conv_1", orgId: "org_1" },
  ]);
  h.db.chatbotConversation.update.mockImplementation(async () => {
    h.order.push("stamp");
    return {};
  });
  h.push.mockImplementation(async () => {
    h.order.push("push");
    return { ok: true };
  });
});

describe("funnel-lead-sync cron", () => {
  it("stamps funnelPushedAt before calling the push (at-most-once)", async () => {
    const res = await GET(
      new Request("https://x/api/cron/funnel-lead-sync") as never,
    );
    const json = await (res as Response).json();

    expect(json).toMatchObject({ ok: true, pushed: 1 });
    expect(h.order).toEqual(["stamp", "push"]);
    expect(h.db.chatbotConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conv_1" },
        data: expect.objectContaining({ funnelPushedAt: expect.any(Date) }),
      }),
    );
  });

  it("does nothing (empty queue) when no org has an enabled integration", async () => {
    h.db.funnelIntegration.findMany.mockResolvedValue([]);

    const res = await GET(
      new Request("https://x/api/cron/funnel-lead-sync") as never,
    );
    const json = await (res as Response).json();

    expect(json).toMatchObject({ ok: true, queueSize: 0, pushed: 0 });
    expect(h.db.chatbotConversation.findMany).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
  });
});
