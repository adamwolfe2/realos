// #183: the seo-scan-worker reaper counted every stuck job as recycled or
// abandoned even when its update failed (.catch(() => null)), so a broken
// reap read as success. Only landed reaps count; failures are reported.
import { describe, expect, it, vi } from "vitest";
import { reapStuckScanJobs } from "@/lib/seo/scan-reaper";

describe("reapStuckScanJobs", () => {
  it("counts only reaps that landed and reports the failures", async () => {
    const update = vi.fn(async ({ where }: { where: { id: string }; data: Record<string, unknown> }) => {
      if (where.id === "bad") throw new Error("db down");
      return {};
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await reapStuckScanJobs(
      { seoScanJob: { update } },
      [
        { id: "requeue", attempts: 0 },
        { id: "abandon", attempts: 2 },
        { id: "bad", attempts: 0 },
      ],
      3,
    );
    expect(res).toEqual({ recycled: 1, abandoned: 1, errors: ["reap bad: db down"] });
    expect(update.mock.calls.find(([a]) => a.where.id === "abandon")?.[0].data.status).toBe("FAILED");
    expect(update.mock.calls.find(([a]) => a.where.id === "requeue")?.[0].data.status).toBe("QUEUED");
  });
});
