"use client";

import * as React from "react";
import { toast } from "sonner";

// Starts the Stripe-hosted trial activation Checkout. The server rebuilds the
// cart from the org (tier, property count, trial_end); the body is a hint.
export function useStartTrialCheckout() {
  const [submitting, setSubmitting] = React.useState(false);

  const start = async (
    tierId: "starter" | "growth" | "scale",
    propertyCount: number,
  ) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId,
          cycle: "monthly",
          propertyCount,
          source: "trial_activation",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.url) {
        toast.error(
          json?.error ??
            `Couldn't start checkout (HTTP ${res.status}). Try again in a minute or email team@leasestack.co.`,
        );
        setSubmitting(false);
        return;
      }
      // Keep submitting=true through the navigation so the button stays in
      // its loading state until Stripe replaces the page.
      window.location.assign(json.url as string);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Network error. Try again shortly.",
      );
      setSubmitting(false);
    }
  };

  return { submitting, start };
}
