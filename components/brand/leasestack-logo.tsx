// LeaseStack lockup: the stacked-floors mark (vector redraw of the
// public/logos/leasestack-wordmark.png render, which is a 1536x1024 glow
// image with no name in it) plus the name set in the app font.
const BANDS = [0, 80, 160, 240, 320, 400];

export function LeaseStackMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 350 453"
      className={className}
      aria-hidden="true"
      fill="#2A4DBC"
    >
      {BANDS.map((dy) => (
        <path
          key={dy}
          d={`M0 ${95 + dy}L198 ${dy}H350V${25 + dy}H216Q206 ${25 + dy} 200 ${33 + dy}L0 ${140 + dy}Z`}
        />
      ))}
    </svg>
  );
}

export function LeaseStackLogo({
  size = 28,
  showName = true,
}: {
  /** Mark height in px; the name scales with it. */
  size?: number;
  showName?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center"
      style={{ height: size, gap: size * 0.32 }}
    >
      <LeaseStackMark className="h-full w-auto" />
      {showName ? (
        <span
          className="font-sans font-semibold tracking-[-0.02em] text-foreground leading-none"
          style={{ fontSize: Math.round(size * 0.72) }}
        >
          LeaseStack
        </span>
      ) : null}
    </span>
  );
}
