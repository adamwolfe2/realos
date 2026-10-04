import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, update, send } = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  send: vi.fn(),
}));
let captured: { errorCount?: number; errorSummary?: string } = {};

vi.mock("@/lib/db", () => ({ prisma: { lead: { findMany, update } } }));
vi.mock("@/lib/cron/auth", () => ({ verifyCronAuth: () => null }));
vi.mock("@/lib/email/review-request", () => ({ sendReviewRequestEmail: send }));
vi.mock("@/lib/health/cron-run", () => ({
  recordCronRun: async (
    _n: string,
    h: () => Promise<{ result: unknown; errorCount?: number; errorSummary?: string }>,
  ) => {
    const r = await h();
    captured = r;
    return r.result;
  },
}));

import { GET } from "@/app/api/cron/review-requests/route";

const lead = (id: string) => ({
  id,
  firstName: "A",
  email: `${id}@x.com`,
  property: { name: "P", googleReviewUrl: "https://g.co/r" },
});

describe("review-requests cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([lead("ok"), lead("bad")]);
    send.mockImplementation(async ({ leadId }: { leadId: string }) =>
      leadId === "ok" ? { ok: true } : { ok: false, error: "Invalid recipient" },
    );
  });

  it("marks only successful sends and reports failures", async () => {
    await GET(new Request("http://x") as never);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].where.id).toBe("ok");
    expect(captured.errorCount).toBe(1);
    expect(captured.errorSummary).toContain("bad: Invalid recipient");
  });
});
