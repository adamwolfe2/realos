import { describe, expect, it } from "vitest";
import { pctChange, resolveWindow } from "@/lib/dashboard/window";

const now = new Date("2026-10-28T12:00:00");

describe("resolveWindow", () => {
  it("defaults to the last 28 days with an equal prior window", () => {
    const w = resolveWindow({}, now);
    expect(w.days).toBe(28);
    expect(w.label).toBe("Last 28 days");
    expect(w.start.getTime() - w.priorStart.getTime()).toBe(28 * 86_400_000);
  });

  it("accepts presets and custom ranges, rejects bad custom input", () => {
    expect(resolveWindow({ range: "7d" }, now).days).toBe(7);
    const custom = resolveWindow({ from: "2026-10-01", to: "2026-10-10" }, now);
    expect(custom.days).toBe(10);
    expect(custom.query).toBe("from=2026-10-01&to=2026-10-10");
    expect(resolveWindow({ from: "2026-10-10", to: "2026-10-01" }, now).days).toBe(28);
    expect(resolveWindow({ from: "nope", to: "2026-10-01" }, now).days).toBe(28);
  });
});

describe("pctChange", () => {
  it("returns null without a baseline", () => {
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(9, 7)).toBe(29);
    expect(pctChange(5, 10)).toBe(-50);
  });
});
