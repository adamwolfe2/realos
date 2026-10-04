"use client";

import * as React from "react";
import { usePlatformHost } from "@/components/analytics/platform-only";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

// @calcom/embed-react stays out of the root-layout chunk: the embed loads
// lazily (pre-warm on marketing pages, or on first open()).
const CalWarmEmbed = dynamic(() => import("./cal-embed"), { ssr: false });

// ---------------------------------------------------------------------------
// Cal.com inline modal — single embed used by every "Book a demo" CTA.
//
// Why a modal instead of a redirect:
//   - Prospect never leaves leasestack.co — brand stays in view, the
//     bounce-back-to-site step disappears entirely
//   - The post-book confirmation lands them right back where they were
//     (same scroll position, same page state) instead of a Cal-hosted
//     thanks page
//   - PostHog / GA4 attribution keeps the original landing page as the
//     converting surface
//
// How it works:
//   - <CalDemoTrigger> is a render-prop button. The child receives an
//     `onClick` it must wire to its own button. Lets every existing CTA
//     keep its bespoke styling.
//   - The Cal embed mounts once at the root of <CalDemoProvider> and
//     stays in the DOM across modal opens — opening + closing is just a
//     CSS visibility flip.
//   - The Cal namespace (`leasestack-intro`) is preregistered with the
//     env-resolved URL on first render so subsequent opens are instant.
//
// Usage:
//   <CalDemoProvider>
//     <CalDemoTrigger>
//       {(open) => (
//         <button onClick={open} className="...">Book a demo</button>
//       )}
//     </CalDemoTrigger>
//   </CalDemoProvider>
//
// The provider is typically mounted once in app/layout.tsx so triggers
// anywhere in the tree can fire it without re-creating the embed.
// ---------------------------------------------------------------------------

// Cal's embed expects a slug like "username/event-slug". Parse our env
// var (which is usually a full https://cal.com/... URL) into that shape.
// Exported: the /book-demo qualification wizard reuses it for its inline
// (non-modal) Cal embed.
export function parseCalSlug(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  // Already a bare slug?
  if (!rawUrl.startsWith("http") && rawUrl.includes("/")) return rawUrl;
  try {
    const u = new URL(rawUrl);
    if (!u.hostname.endsWith("cal.com")) return null;
    return u.pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    return null;
  }
}

type CalContextValue = {
  open: () => void;
  isAvailable: boolean;
};

const CalDemoContext = React.createContext<CalContextValue | null>(null);

/**
 * Provider that mounts the Cal namespace + handles open/close state.
 * Should sit high in the tree (app/layout.tsx) so any descendent button
 * can fire it without re-mounting the iframe.
 */
export function CalDemoProvider({ children }: { children: React.ReactNode }) {
  const slug = parseCalSlug(process.env.NEXT_PUBLIC_CAL_BOOK_URL);
  // LeaseStack's demo embed must not pre-warm on customer tenant sites.
  const onPlatform = usePlatformHost();
  // Logged-in surfaces never show the demo CTA; skip the pre-warm there so
  // they don't download the Cal embed. open() still works (lazy import).
  const pathname = usePathname() ?? "";
  const warm =
    onPlatform &&
    !pathname.startsWith("/portal") &&
    !pathname.startsWith("/admin");

  const open = React.useCallback(() => {
    if (!slug) return;
    // Call the API directly so arbitrary buttons (not just
    // <a data-cal-link>) can trigger it.
    void import("./cal-embed")
      .then((m) => {
        track("demo_modal_opened", m.demoContext());
        return m.openCalModal(slug);
      })
      .catch((err) => {
        console.error("[cal-demo] failed to open Cal modal", err);
      });
  }, [slug]);

  const value = React.useMemo<CalContextValue>(
    () => ({ open, isAvailable: !!slug }),
    [open, slug],
  );

  return (
    <CalDemoContext.Provider value={value}>
      {children}
      {/* Pre-render the Cal embed off-screen so the iframe is warm by
          the time a user clicks. */}
      {slug && warm ? <CalWarmEmbed slug={slug} /> : null}
    </CalDemoContext.Provider>
  );
}

/**
 * Hook for triggering the Cal modal from anywhere. Returns null-safe
 * fallbacks so a component that needs Cal can still render before the
 * provider mounts (returns isAvailable=false in that case).
 */
export function useCalDemo(): CalContextValue {
  const ctx = React.useContext(CalDemoContext);
  if (ctx) return ctx;
  return { open: () => {}, isAvailable: false };
}

/**
 * Render-prop trigger. Lets every CTA keep its own button styling while
 * sharing the Cal open behavior. The child receives an `open` callback
 * to wire to its onClick.
 */
export function CalDemoTrigger({
  children,
  fallbackHref,
}: {
  children: (
    open: () => void,
    isAvailable: boolean,
  ) => React.ReactNode;
  /**
   * When the Cal embed isn't available (env var missing in preview,
   * provider not mounted yet), child can use this href to render a
   * plain link instead. Optional; if omitted, the trigger fires nothing.
   */
  fallbackHref?: string;
}) {
  const { open, isAvailable } = useCalDemo();
  const handler = React.useCallback(() => {
    if (isAvailable) {
      open();
    } else if (fallbackHref) {
      window.location.href = fallbackHref;
    }
  }, [open, isAvailable, fallbackHref]);
  return <>{children(handler, isAvailable)}</>;
}
