"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Plug, X } from "lucide-react";

// ---------------------------------------------------------------------------
// FirstRunOverlay — "Start here" full-screen modal for brand-new operators.
//
// Renders when the org has zero connectors, zero properties, AND zero leads
// (gated by the server). The portal /portal dashboard would otherwise show a
// 32-item nav with empty KPI tiles — overwhelming for someone who hasn't
// hooked anything up. This overlay collapses the surface down to ONE primary
// CTA: "Connect your first integration".
//
// Dismissal is persisted in localStorage so the operator can skip and explore
// the empty dashboard if they want. The server-side gate still flips off the
// moment a real connector lands, so dismissed-then-connected users don't
// keep seeing it.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "ls_first_run_overlay_dismissed";

type Props = {
  shouldShow: boolean;
  orgName: string;
};

export function FirstRunOverlay({ shouldShow, orgName }: Props) {
  // Default to dismissed=true so first paint never flashes the overlay.
  // useEffect promotes the real value once we can read localStorage.
  const [dismissed, setDismissed] = React.useState<boolean>(true);
  const [mounted, setMounted] = React.useState<boolean>(false);

  React.useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    setDismissed(stored === "1");
    setMounted(true);
  }, []);

  function handleDismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    setDismissed(true);
  }

  if (!shouldShow || !mounted || dismissed) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-overlay-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm animate-in fade-in duration-300"
    >
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="px-7 pt-8 pb-7 space-y-5">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Plug className="h-4 w-4" strokeWidth={1.75} />
          </div>

          <div className="space-y-2">
            <h2
              id="first-run-overlay-title"
              className="text-xl font-semibold tracking-tight text-foreground"
            >
              Start here, {orgName}.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your dashboard is waiting on real data. Connect a single
              integration — AppFolio, Google Analytics, Google Ads, or your
              pixel — and every tile, chart, and insight begins to populate
              within minutes.
            </p>
          </div>

          <Link
            href="/portal/connect"
            onClick={handleDismiss}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 h-11 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Connect your first integration
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <button
            type="button"
            onClick={handleDismiss}
            className="block w-full text-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            I&apos;ll explore on my own first
          </button>
        </div>
      </div>
    </div>
  );
}
