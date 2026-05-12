"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { WEBSITE_BUILDS } from "@/lib/billing/catalog";

// ---------------------------------------------------------------------------
// WebsiteBuildCard
//
// Surfaces the paid custom-website-build offer on /portal/billing.
// Not part of the trial — clicking either tier creates a Stripe
// Checkout session for the one-time fee. Once paid, the customer is
// routed to the Cal.com kickoff-call booking via the success page.
//
// We render two tiers side-by-side (Standard / Premium) with their
// bullets + delivery window. The card stays visible regardless of
// trial state so customers can come back later.
// ---------------------------------------------------------------------------

export function WebsiteBuildCard() {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const handle = async (buildId: "standard" | "premium") => {
    if (pendingId) return;
    setPendingId(buildId);
    try {
      const res = await fetch("/api/billing/website-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.url) {
        toast.error(
          json?.error ??
            `Couldn't start checkout (HTTP ${res.status}). Try again in a minute.`,
        );
        setPendingId(null);
        return;
      }
      window.location.assign(json.url as string);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Network error. Try again shortly.",
      );
      setPendingId(null);
    }
  };

  return (
    <section
      className="rounded-lg p-5 space-y-4"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e8e6dc",
      }}
    >
      <div>
        <div
          className="inline-flex items-center gap-2 mb-1.5"
          style={{
            color: "#2563EB",
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          <Sparkles size={12} strokeWidth={2.5} aria-hidden="true" />
          Done-for-you
        </div>
        <h2 className="text-sm font-semibold">Need a custom marketing site?</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-xl">
          Our team builds custom property marketing sites with your
          AppFolio listings, chatbot, and pixel installed out of the box.
          One-time fee, paid up front. A kickoff call follows checkout.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {WEBSITE_BUILDS.map((b) => {
          const submitting = pendingId === b.id;
          return (
            <div
              key={b.id}
              className="rounded-lg p-4 flex flex-col"
              style={{
                backgroundColor: "#faf9f5",
                border: "1px solid #e8e6dc",
              }}
            >
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold">{b.uiLabel}</h3>
                <div className="text-right">
                  <div className="text-base font-bold tabular-nums">
                    $
                    {Math.round(b.unitAmountCents / 100).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    one-time
                  </div>
                </div>
              </div>
              <ul className="space-y-1 mb-3 flex-1">
                {b.bullets.map((line) => (
                  <li
                    key={line}
                    className="text-[11.5px] text-muted-foreground leading-snug pl-3 relative"
                  >
                    <span
                      className="absolute left-0 top-1.5 inline-block rounded-full"
                      style={{
                        width: 4,
                        height: 4,
                        backgroundColor: "#2563EB",
                      }}
                    />
                    {line}
                  </li>
                ))}
              </ul>
              <p className="text-[10.5px] text-muted-foreground mb-3">
                Delivered in {b.deliveryWindow}
              </p>
              <button
                type="button"
                onClick={() => handle(b.id)}
                disabled={!!pendingId}
                className="inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-progress"
                style={{
                  backgroundColor: "#2563EB",
                  color: "#ffffff",
                  padding: "8px 14px",
                }}
              >
                {submitting ? (
                  <>
                    <Loader2
                      className="animate-spin"
                      size={13}
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                    Starting checkout…
                  </>
                ) : (
                  `Get a ${b.uiLabel.toLowerCase()}`
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Already have a website? Skip this — install the chatbot and
        pixel from your portal integrations to use LeaseStack on your
        existing site at no extra cost.
      </p>
    </section>
  );
}
