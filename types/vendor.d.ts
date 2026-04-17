/**
 * Ambient type declarations for third-party embed scripts that attach to
 * the global `window` object at runtime.
 */

export {};

declare global {
  /* ── Cal.com Embed ──────────────────────────────────────────────────── */

  interface CalFunction {
    (...args: unknown[]): void;
    q?: unknown[];
    loaded?: boolean;
    ns: Record<string, CalFunction>;
  }

  /* ── Mirror App / iFrame auto-resize ────────────────────────────────── */

  interface Window {
    Cal?: CalFunction;
    /** Guard flag set by our CalEmbed component to prevent double-init */
    __calPortalInitialized?: boolean;
    iFrameSetup?: (el: HTMLIFrameElement) => void;
  }
}
