import { describe, expect, it } from "vitest";
import { impactWindow, splitCounts } from "@/lib/chatbot/learning/impact";

const day = 24 * 60 * 60 * 1000;
const applied = new Date("2026-10-01T00:00:00Z");
const at = (d: number) => new Date(applied.getTime() + d * day);

describe("fix impact windows", () => {
  it("is too early under 7 days", () => {
    expect(impactWindow(applied, at(6.9)).window).toBeNull();
  });

  it("uses equal windows capped at 30 days", () => {
    expect(impactWindow(applied, at(10)).window?.days).toBe(10);
    expect(impactWindow(applied, at(90)).window?.days).toBe(30);
  });

  it("counts before and since, ignoring dates outside both windows", () => {
    const w = impactWindow(applied, at(10)).window!;
    const dates = [at(-11), at(-10), at(-3), at(-0.01), at(0), at(9.9), at(10), at(20)];
    expect(splitCounts(dates, w)).toEqual({ before: 3, after: 2 });
  });
});
