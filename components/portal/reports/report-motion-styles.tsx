// ---------------------------------------------------------------------------
// ReportMotionStyles — the client report's scroll-reveal CSS, injected as a
// raw <style> rather than living in globals.css.
//
// Two reasons it is here and not in globals.css:
//
//  1. Lightning CSS (Tailwind v4 / Next) strips `animation-timeline` at this
//     project's browser targets, so the rules never reached the browser —
//     verified 2026-09-19: the class was absent from the compiled sheet.
//  2. The report travels. Shipping its motion with the component keeps a
//     saved or forwarded page behaving like the original.
//
// CSS-only by design. The previous JS version (InView + .ls-reveal) hid every
// block until an IntersectionObserver stamped data-inview; when hydration
// failed the whole report rendered BLANK. A document we send to clients must
// never depend on JS to be legible. Here the hidden start state lives inside
// @supports (animation-timeline: view()), so a browser can only hide content
// it is also able to animate back — and every keyframe declares just `from`,
// making the element's base style its finished state. No support, reduced
// motion, or print: finished content, immediately.
//
// Stagger via --reveal-step (unitless index): each step delays the entry
// range by 3% of the element's travel through the viewport.
// ---------------------------------------------------------------------------
export function ReportMotionStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
@keyframes ls-view-rise-in { from { opacity: 0; transform: translateY(16px); } }
@keyframes ls-view-bar-in { from { transform: scaleX(0); } }
@keyframes ls-view-col-in { from { transform: scaleY(0); } }

.ls-view-rise, .ls-view-grow-x, .ls-view-grow-y { --reveal-step: 0; }
.ls-view-grow-x { transform-origin: left center; }
.ls-view-grow-y { transform-origin: center bottom; }

@supports (animation-timeline: view()) {
  @media screen and (prefers-reduced-motion: no-preference) {
    .ls-view-rise, .ls-view-grow-x, .ls-view-grow-y {
      animation-duration: 1ms;
      animation-fill-mode: both;
      animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
      animation-timeline: view();
      animation-range: entry calc(4% + var(--reveal-step) * 3%)
                       entry calc(62% + var(--reveal-step) * 3%);
    }
    .ls-view-rise { animation-name: ls-view-rise-in; }
    .ls-view-grow-x { animation-name: ls-view-bar-in; }
    .ls-view-grow-y { animation-name: ls-view-col-in; }
  }
}

@media print {
  .ls-view-rise, .ls-view-grow-x, .ls-view-grow-y {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}`,
      }}
    />
  );
}
