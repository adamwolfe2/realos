"use client";

import * as React from "react";

// ---------------------------------------------------------------------------
// InView — the one viewport-reveal trigger. Sets `data-inview` on its element
// when it first intersects (fire-once by default, ~0.2 visibility threshold
// per the DESIGN.md motion spec). Pure attribute-toggler: all visuals live in
// CSS (`.ls-reveal`, `.ls-grow-x` in globals.css key off [data-inview]), so
// it composes with any class and costs nothing when unused.
//
// SSR renders WITHOUT the attribute; if JS never runs, a `no-js`-style
// fallback isn't needed because the paired CSS classes hide content only via
// transition start states that the global reduced-motion net also disables.
// ---------------------------------------------------------------------------

export function InView({
  as: Tag = "div",
  amount = 0.2,
  once = true,
  className,
  children,
}: {
  as?: "div" | "section" | "ul" | "span";
  /** Fraction of the element that must be visible to trigger (0..1). */
  amount?: number;
  /** Fire once and stay revealed (default) or toggle on exit. */
  once?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (el == null) return;
    if (typeof IntersectionObserver === "undefined") {
      el.setAttribute("data-inview", "");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.setAttribute("data-inview", "");
            if (once) io.disconnect();
          } else if (!once) {
            el.removeAttribute("data-inview");
          }
        }
      },
      { threshold: amount },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [amount, once]);

  return (
    <Tag ref={ref as React.RefObject<never>} className={className}>
      {children}
    </Tag>
  );
}
