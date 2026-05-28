import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// Sparkline — pure SVG, no client JS, no chart library. Renders a 14-day
// trend line at the bottom of every SignalCard. Defaults to a 80×24 viewBox
// so the line strokes crisp on any card width via preserveAspectRatio.
// ----------------------------------------------------------------------------

export type SparklineProps = {
  points: number[];
  /** Visual tone — drives the stroke color. */
  tone?: "positive" | "negative" | "neutral";
  className?: string;
};

export function Sparkline({
  points,
  tone = "neutral",
  className,
}: SparklineProps) {
  // Empty / degenerate input → render a flat hairline so the slot keeps its
  // baseline; the SignalCard layout depends on this height.
  if (points.length === 0) {
    return (
      <svg
        viewBox="0 0 80 24"
        preserveAspectRatio="none"
        className={cn("w-full h-6", className)}
        aria-hidden
      >
        <line
          x1={0}
          y1={12}
          x2={80}
          y2={12}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
      </svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = points.length > 1 ? 80 / (points.length - 1) : 80;

  // Normalize each point to the 24-unit Y axis. Invert so high values draw
  // closer to the top of the SVG (standard chart orientation).
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = 22 - ((p - min) / range) * 20;
    return { x, y };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(" ");

  // Build an area path under the line for subtle fill volume.
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(2)},24 L0,24 Z`;

  const colorClass =
    tone === "positive"
      ? "text-emerald-500"
      : tone === "negative"
        ? "text-rose-500"
        : "text-muted-foreground";

  const fillOpacity = tone === "neutral" ? 0.08 : 0.12;

  return (
    <svg
      viewBox="0 0 80 24"
      preserveAspectRatio="none"
      className={cn("w-full h-6", colorClass, className)}
      aria-hidden
    >
      <path d={areaPath} fill="currentColor" fillOpacity={fillOpacity} />
      <path
        d={linePath}
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
