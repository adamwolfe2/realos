"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import {
  TIERS,
  computeGraduatedMonthlyCents,
} from "@/lib/billing/catalog";

// ---------------------------------------------------------------------------
// TrialActivationCard
//
// Renders on /portal/billing when the org is in the TRIALING state. Two
// pieces of information drive the layout: the tier they picked during
// onboarding (so we know which Stripe price to spin up) and the live
// property count (so the quoted monthly total reflects what they'll
// actually be billed, including bracket discounts).
//
// Clicking "Activate now" POSTs to /api/billing/checkout with the
// current tier + count + monthly cycle. The endpoint mints a Stripe
// Checkout session against the graduated tiered price; on completion
// the webhook flips subscriptionStatus from TRIALING to ACTIVE.
// ---------------------------------------------------------------------------

function tierLabel(id: "starter" | "growth" | "scale"): string {
  return id === "starter" ? "Foundation" : id === "growth" ? "Growth" : "Scale";
}

function tierBaseMonthlyCents(id: "starter" | "growth" | "scale"): number {
  const t = TIERS.find((x) => x.id === id);
  return t ? t.monthly.unitAmountCents : 0;
}

function daysLeft(end: Date | null): number | null {
  if (!end) return null;
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function TrialActivationCard({
  tierId,
  propertyCount,
  trialEndsAt,
}: {
  tierId: "starter" | "growth" | "scale";
  propertyCount: number;
  trialEndsAt: Date | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  const base = tierBaseMonthlyCents(tierId);
  const totalMonthly = Math.round(
    computeGraduatedMonthlyCents(base, propertyCount) / 100,
  );
  const days = daysLeft(trialEndsAt);
  const expired = days === 0;

  const handle = async () => {
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
            `Couldn't start checkout (HTTP ${res.status}). Try again in a minute or email hello@leasestack.co.`,
        );
        setSubmitting(false);
        return;
      }
      window.location.assign(json.url as string);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Network error. Try again shortly.",
      );
      setSubmitting(false);
    }
    // Keep submitting=true through the navigation so the button stays
    // in its loading state until the Stripe page replaces this view.
  };

  return (
    <section
      className="rounded-lg p-5 space-y-4"
      style={{
        backgroundColor: expired
          ? "rgba(217,119,6,0.08)"
          : "rgba(37,99,235,0.04)",
        border: expired
          ? "1px solid rgba(217,119,6,0.30)"
          : "1px solid rgba(37,99,235,0.30)",
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div
            className="inline-flex items-center gap-2 mb-1.5"
            style={{
              color: expired ? "#92400e" : "#2563EB",
              fontFamily: "var(--font-mono)",
              fontSize: "10.5px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            <Sparkles size={12} strokeWidth={2.5} aria-hidden="true" />
            {expired ? "Trial expired" : `Free trial · ${days ?? 0} days left`}
          </div>
          <h2
            style={{
              color: "#141413",
              fontFamily: "var(--font-sans)",
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "-0.012em",
            }}
          >
            Activate {tierLabel(tierId)} for {propertyCount}{" "}
            {propertyCount === 1 ? "property" : "properties"}
          </h2>
          <p
            className="mt-1"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              lineHeight: 1.55,
            }}
          >
            {expired
              ? "Your trial has ended. Activate to keep your workspace fully unlocked. You can change tiers or property count at checkout."
              : "Lock in today and your workspace stays unlocked when the trial ends. Activating mid-trial gives you full credit for the remaining days."}
          </p>
        </div>
        <div
          className="text-right shrink-0"
          style={{
            fontFamily: "var(--font-sans)",
          }}
        >
          <div
            style={{
              color: "#141413",
              fontSize: "26px",
              fontWeight: 700,
              letterSpacing: "-0.018em",
              lineHeight: 1,
            }}
          >
            ${totalMonthly.toLocaleString()}
          </div>
          <div
            style={{
              color: "#88867f",
              fontSize: "12px",
              marginTop: "2px",
            }}
          >
            /mo · {propertyCount}{" "}
            {propertyCount === 1 ? "property" : "properties"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/pricing")}
          className="text-xs underline underline-offset-2 transition-colors"
          style={{
            color: "#5e5d59",
            fontFamily: "var(--font-sans)",
            padding: "4px 8px",
          }}
        >
          Change tier
        </button>
        <button
          type="button"
          onClick={handle}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full transition-colors disabled:opacity-60 disabled:cursor-progress"
          style={{
            backgroundColor: expired ? "#92400e" : "#2563EB",
            color: "#ffffff",
            padding: "9px 18px",
            fontFamily: "var(--font-sans)",
            fontSize: "13.5px",
            fontWeight: 600,
          }}
        >
          {submitting ? (
            <>
              <Loader2
                className="animate-spin"
                size={14}
                strokeWidth={2.5}
                aria-hidden="true"
              />
              Starting checkout…
            </>
          ) : expired ? (
            "Activate subscription"
          ) : (
            "Activate now"
          )}
        </button>
      </div>
    </section>
  );
}
