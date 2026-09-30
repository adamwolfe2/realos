import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Regression (2026-09-30): the aeo-scan cron's deadline was only checked
// between orgs. With one real org, a single runAeoScan (~280s of sequential
// engine calls) ran past maxDuration and left CronRun stuck at "running".
// runAeoScan must stop starting new prompts once the deadline passes.

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      findMany: vi.fn(async () => [
        {
          id: "p1",
          orgId: "o1",
          name: "Telegraph Commons",
          websiteUrl: "https://tc.test",
          city: "Berkeley",
          state: "CA",
          propertyType: "RESIDENTIAL",
          residentialSubtype: "STUDENT_HOUSING",
          commercialSubtype: null,
          addressLine1: null,
        },
      ]),
    },
    aeoCustomPrompt: { findMany: vi.fn(async () => []) },
  },
}));

const { runAeoScan } = await import("@/lib/aeo/orchestrate");

function engine(onCall: () => void) {
  return {
    engine: "CLAUDE",
    runPrompt: vi.fn(async () => {
      onCall();
      return { skipped: true };
    }),
  } as never;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("runAeoScan deadline", () => {
  it("runs no prompts when the deadline has already passed", async () => {
    const e = engine(() => {});
    const r = await runAeoScan({ orgId: "o1", engines: [e], deadline: Date.now() - 1 });
    expect(r.promptsRun).toBe(0);
  });

  it("stops after the prompt that crossed the deadline", async () => {
    // Each engine call "takes" 60s; deadline is 30s out.
    const e = engine(() => vi.advanceTimersByTime(60_000));
    const r = await runAeoScan({ orgId: "o1", engines: [e], deadline: Date.now() + 30_000 });
    expect(r.promptsRun).toBe(1);
  });

  it("runs every prompt without a deadline", async () => {
    const e = engine(() => vi.advanceTimersByTime(60_000));
    const r = await runAeoScan({ orgId: "o1", engines: [e] });
    expect(r.promptsRun).toBeGreaterThan(1);
  });
});
