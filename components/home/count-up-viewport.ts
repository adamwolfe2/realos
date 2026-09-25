// Pure geometry check, split out of count-up.tsx so it's importable from a
// plain (non-DOM) vitest test. No React/framer-motion — just numbers.
export function isAlreadyInViewport(
  top: number,
  bottom: number,
  viewportHeight: number,
): boolean {
  return top < viewportHeight * 0.9 && bottom > 0;
}
