import { describe, expect, it, vi } from "vitest";

// cubic P1 on #173: failed rows from a retired source ("cursive") must never
// occupy the 25-row retry batch, or they starve clerk/resend/stripe retries.

const findMany = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/db", () => ({ prisma: { webhookEvent: { findMany } } }));
vi.mock("@/lib/cron/auth", () => ({ verifyCronAuth: () => null }));
vi.mock("@/lib/health/cron-run", () => ({
  recordCronRun: (_n: string, fn: () => Promise<unknown>) => fn(),
}));

const { GET } = await import("@/app/api/cron/webhook-retry/route");

describe("webhook-retry due query", () => {
  it("only selects sources that still have a webhook route", async () => {
    await GET(new Request("https://x.test/api/cron/webhook-retry"));
    const where = findMany.mock.calls[0][0].where;
    expect(where.source).toEqual({ in: ["clerk", "resend", "stripe"] });
    expect(where.source.in).not.toContain("cursive");
  });
});
