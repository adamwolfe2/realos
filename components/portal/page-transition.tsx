"use client";

import { usePathname } from "next/navigation";

// ---------------------------------------------------------------------------
// PageTransition — opacity-only fade on route change. Keyed on pathname so
// every route swap remounts the wrapper and replays the CSS enter animation
// (.ls-route-fade in globals.css, disabled under prefers-reduced-motion).
// Pure CSS: no framer-motion in the shared portal layout chunk and no
// exit-wait before the next route paints.
// ---------------------------------------------------------------------------

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="ls-route-fade">
      {children}
    </div>
  );
}
