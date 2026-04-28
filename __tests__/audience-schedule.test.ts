import { describe, it, expect } from "vitest";
import { computeNextRunAt } from "@/lib/audiences/schedule";

// The five inline test cases documented in lib/audiences/schedule.ts.
// Anchors are UTC; we use ISO strings throughout to keep the arithmetic
// timezone-free and readable.

describe("computeNextRunAt", () => {
  it("DAILY: same day, future hour → today at hourUtc", () => {
    const from = new Date("2026-04-28T03:00:00.000Z");
    const got = computeNextRunAt("DAILY", null, 6, from);
    expect(got.toISOString()).toBe("2026-04-28T06:00:00.000Z");
  });

  it("DAILY: hour already passed → tomorrow at hourUtc", () => {
    const from = new Date("2026-04-28T09:00:00.000Z");
    const got = computeNextRunAt("DAILY", null, 6, from);
    expect(got.toISOString()).toBe("2026-04-29T06:00:00.000Z");
  });

  it("WEEKLY: Tue 08:00 → next Mon 09:00 (6 days away)", () => {
    const from = new Date("2026-04-28T08:00:00.000Z"); // Tue
    const got = computeNextRunAt("WEEKLY", 1, 9, from); // Mon
    expect(got.toISOString()).toBe("2026-05-04T09:00:00.000Z");
  });

  it("WEEKLY: same day-of-week with future hour → same day", () => {
    const from = new Date("2026-04-28T08:00:00.000Z"); // Tue
    const got = computeNextRunAt("WEEKLY", 2, 9, from); // Tue
    expect(got.toISOString()).toBe("2026-04-28T09:00:00.000Z");
  });

  it("WEEKLY: same day-of-week with hour passed → +7 days", () => {
    const from = new Date("2026-04-28T10:00:00.000Z"); // Tue
    const got = computeNextRunAt("WEEKLY", 2, 9, from); // Tue
    expect(got.toISOString()).toBe("2026-05-05T09:00:00.000Z");
  });

  it("rejects invalid hourUtc", () => {
    expect(() => computeNextRunAt("DAILY", null, 24)).toThrow();
    expect(() => computeNextRunAt("DAILY", null, -1)).toThrow();
  });

  it("rejects WEEKLY without dayOfWeek", () => {
    expect(() =>
      computeNextRunAt("WEEKLY", null, 9, new Date("2026-04-28T00:00:00.000Z")),
    ).toThrow();
  });
});
