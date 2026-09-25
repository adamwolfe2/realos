import { describe, it, expect } from "vitest";
import { isAlreadyInViewport } from "../components/home/count-up-viewport";

// Regression: CountUp used to flash real -> 0 -> real on mount whenever the
// number was already on screen at load (hero snapshot) or the walkthrough
// remounted a beat that was already visible. The fix marks the number
// "started" (skip the from-zero animation) if it's already in the viewport
// at mount, instead of waiting for framer's IntersectionObserver to fire.
describe("isAlreadyInViewport", () => {
  const vh = 800;

  it("is true for an element already on screen at mount", () => {
    expect(isAlreadyInViewport(100, 200, vh)).toBe(true);
  });

  it("is true for an element straddling the top edge", () => {
    expect(isAlreadyInViewport(-50, 50, vh)).toBe(true);
  });

  it("is false for an element below the fold", () => {
    expect(isAlreadyInViewport(1000, 1100, vh)).toBe(false);
  });

  it("is false for an element scrolled fully past above the viewport", () => {
    expect(isAlreadyInViewport(-200, -50, vh)).toBe(false);
  });
});
