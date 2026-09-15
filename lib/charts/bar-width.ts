/**
 * Bar width for a count-derived progress/funnel bar.
 *
 * Every bar in the portal carried its own `Math.max(floor, pct)`. The floor is
 * there so a small non-zero value still draws something visible — but applied
 * to zero it invented a bar where the answer is none, so a reader saw "some"
 * on a stage that never happened.
 *
 * The floor now applies only to a value that actually exists.
 *
 * Usage:
 *   style={{ width: `${barPct(stage.value, max)}%` }}
 */
export function barPct(value: number, max: number, floor = 2): number {
  if (!Number.isFinite(value) || !Number.isFinite(max)) return 0;
  if (value <= 0 || max <= 0) return 0;
  return Math.min(100, Math.max(floor, (value / max) * 100));
}
