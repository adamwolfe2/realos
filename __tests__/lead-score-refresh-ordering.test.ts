import { describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { lead: { findMany, update: vi.fn() } } }));
vi.mock("@/lib/cron/auth", () => ({ verifyCronAuth: () => null }));
vi.mock("@/lib/health/cron-run", () => ({
  recordCronRun: async (_n: string, h: () => Promise<{ result: unknown }>) =>
    (await h()).result,
}));

import { GET } from "@/app/api/cron/lead-score-refresh/route";

describe("lead-score-refresh cron", () => {
  it("takes the stalest leads first, deterministically", async () => {
    findMany.mockResolvedValue([]);
    await GET(new Request("http://x") as never);
    expect(findMany.mock.calls[0][0].orderBy).toEqual([
      { updatedAt: "asc" },
      { id: "asc" },
    ]);
  });
});
