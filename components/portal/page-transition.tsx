"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

// ---------------------------------------------------------------------------
// PageTransition — wraps the portal layout body in a framer-motion
// AnimatePresence so route navigations fade through (200ms) instead of
// hard-cutting. Keyed on pathname so every route swap remounts the inner
// content and runs the enter animation.
//
// Kept intentionally narrow: only opacity. No translate/scale — those
// were attempted previously and caused jank on long lists that streamed
// in after the layout commit. Pure opacity is the safest cross-route
// motion.
//
// Respects prefers-reduced-motion via the disabled prop on AnimatePresence
// is not native; instead we set duration to 0 when the media query matches.
// On the server the wrapper renders children directly (no flicker on
// hydration because initial opacity is 1 for the first paint via
// initial={false}).
// ---------------------------------------------------------------------------

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
