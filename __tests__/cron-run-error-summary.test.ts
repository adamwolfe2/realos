import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression (2026-09-29): partial cron runs stored no reason (181 seo-sync
// partials, all with CronRun.error = null), so they were undiagnosable.

const exec = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: () => Promise.resolve([{ id: "run_1" }]),
    $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
      exec(strings.join("?"), values);
      return Promise.resolve(1);
    },
  },
}));

const { recordCronRun } = await import("@/lib/health/cron-run");

beforeEach(() => exec.mockReset());

describe("recordCronRun errorSummary", () => {
  it("stores the summary in CronRun.error on a partial run", async () => {
    await recordCronRun("job", async () => ({
      result: 1,
      errorCount: 1,
      errorSummary: "org_1: 404 segment not found",
    }));
    const [sql, values] = exec.mock.calls[0];
    expect(sql).toContain('"error"');
    expect(values).toContain("partial");
    expect(values).toContain("org_1: 404 segment not found");
  });

  it("stores null on a clean run even if a summary is passed", async () => {
    await recordCronRun("job", async () => ({
      result: 1,
      errorCount: 0,
      errorSummary: "",
    }));
    const [, values] = exec.mock.calls[0];
    expect(values).toContain("ok");
    expect(values).toContain(null);
  });
});
