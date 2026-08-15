"use client";

import { CountUpValue } from "@/components/portal/ui/motion";

// Thin wrapper over the shared CountUpValue (components/portal/ui/motion.tsx)
// keeping this file's historical prop surface. The old local RAF loop fired
// on MOUNT, so below-the-fold numbers finished counting before anyone saw
// them — CountUpValue is viewport-triggered (counts when scrolled into view)
// and reduced-motion aware, and this was one of three duplicate count-up
// implementations.
export function CountUp({
  to,
  durationMs = 900,
  className,
  style,
}: {
  to: number;
  durationMs?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <CountUpValue
      value={Math.max(0, Math.round(to))}
      duration={durationMs / 1000}
      locale={false}
      className={className}
      style={style}
    />
  );
}
