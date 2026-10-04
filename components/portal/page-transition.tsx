"use client";

import { useRef } from "react";
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
  // Skip the fade on the first paint (matches the old framer-motion
  // initial={false}); only client-side route changes animate.
  const firstPath = useRef(pathname);
  return (
    <div
      key={pathname}
      className={pathname === firstPath.current ? undefined : "ls-route-fade"}
    >
      {children}
    </div>
  );
}
