import { describe, expect, it, vi } from "vitest";

// runSourceReplenish catches its own failures and returns them in the
// summary; the cron must still count them or the run records "ok".
const m = vi.hoisted(() => ({ ret: null as null | { errorCount?: number; errorSummary?: string } }));

vi.mock("@/lib/cron/auth", () => ({ verifyCronAuth: () => null }));
vi.mock("@/lib/health/cron-run", () => ({
  recordCronRun: async (_n: string, fn: () => Promise<{ result: unknown; errorCount?: number; errorSummary?: string }>) => {
    const r = await fn();
    m.ret = r;
    return r.result;
  },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    marketplaceSyncSource: {
      findMany: async () => [
        { id: "s1", name: "Broken" },
        { id: "s2", name: "Partial" },
        { id: "s3", name: "Clean" },
      ],
    },
  },
}));
const base = { fetchedCount: 0, enrichedCount: 0, upsertedCount: 1, newCount: 0, refreshedCount: 0, expiredCount: 0 };
vi.mock("@/lib/marketplace/cursive-sync", () => ({
  runSourceReplenish: async (s: { id: string }) =>
    s.id === "s1"
      ? { ...base, status: "FAILED", failedCount: 0, errorMessage: "upstream 500" }
      : s.id === "s2"
        ? { ...base, status: "SUCCESS", failedCount: 3 }
        : { ...base, status: "SUCCESS", failedCount: 0 },
}));

const { GET } = await import("@/app/api/cron/marketplace-replenish/route");

describe("marketplace-replenish errorCount", () => {
  it("counts FAILED summaries and member failures", async () => {
    await GET(new Request("https://x/api/cron/marketplace-replenish") as never);
    expect(m.ret?.errorCount).toBe(2);
    expect(m.ret?.errorSummary).toContain("Broken: upstream 500");
    expect(m.ret?.errorSummary).toContain("Partial: 3 member(s) failed");
  });
});
