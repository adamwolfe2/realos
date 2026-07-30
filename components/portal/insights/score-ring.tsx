// ----------------------------------------------------------------------------
// ScoreRing — donut arc for the Insights page's Overall score tile. Only
// consumer used by is SignalCard (components/portal/insights/signal-card.tsx).
// Pure inline SVG, no client JS: the fill transition is CSS-only and honors
// prefers-reduced-motion via the motion-reduce: variant (instant snap).
// ----------------------------------------------------------------------------

export function ScoreRing({
  value,
  size = 68,
  strokeWidth = 6,
}: {
  /** 0..100 score. */
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Overall score ${Math.round(clamped)} out of 100`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none" aria-hidden="true">
        <span className="font-mono text-[20px] font-semibold tabular-nums text-foreground">
          {Math.round(clamped)}
        </span>
        <span className="mt-0.5 text-[9px] font-medium text-muted-foreground">
          / 100
        </span>
      </div>
    </div>
  );
}
