import { describe, it, expect } from "vitest";
import { barPct } from "@/lib/charts/bar-width";

describe("barPct", () => {
  it("draws nothing for a zero value — the defect this replaces", () => {
    expect(barPct(0, 120)).toBe(0);
    expect(barPct(0, 0)).toBe(0);
  });

  it("keeps a small non-zero value visible via the floor", () => {
    expect(barPct(1, 10_000)).toBe(2);
    expect(barPct(1, 10_000, 6)).toBe(6);
  });

  it("scales proportionally above the floor and caps at 100", () => {
    expect(barPct(60, 120)).toBe(50);
    expect(barPct(120, 120)).toBe(100);
    expect(barPct(240, 120)).toBe(100);
  });

  it("returns 0 rather than NaN for bad input", () => {
    expect(barPct(Number.NaN, 10)).toBe(0);
    expect(barPct(5, Number.NaN)).toBe(0);
    expect(barPct(-3, 10)).toBe(0);
  });
});
