"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useStartTrialCheckout } from "@/components/portal/billing/use-start-trial-checkout";

// ---------------------------------------------------------------------------
// TrialActivationCard
//
// Renders on /portal/billing when the org is in the TRIALING state. Two
// pieces of information drive the layout: the tier they picked during
// onboarding (so we know which Stripe price to spin up) and the live
// property count (so the quoted monthly total reflects what they'll
// actually be billed, including bracket discounts).
//
// "Add card" POSTs to /api/billing/checkout (useStartTrialCheckout). The
// endpoint mints a Stripe Checkout session with trial_end = the org's trial
// end, so nothing is charged today. Once a card is on file the card shows the
// first charge amount and date instead of the button.
// ---------------------------------------------------------------------------

function tierLabel(id: "starter" | "growth" | "scale"): string {
  return id === "starter" ? "Foundation" : id === "growth" ? "Growth" : "Scale";
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
  monthlyTotalCents,
  cardOnFile,
  chargeDateLabel,
}: {
  tierId: "starter" | "growth" | "scale";
  propertyCount: number;
  trialEndsAt: Date | null;
  // The package's graduated monthly total for this property count: the same
  // number Stripe charges for the tier price checkout creates.
  monthlyTotalCents: number;
  cardOnFile: boolean;
  // Server-formatted (Pacific) so server and client render the same date.
  chargeDateLabel: string | null;
}) {
  const { submitting, start } = useStartTrialCheckout();

  const totalMonthly = Math.round(monthlyTotalCents / 100);
  const days = daysLeft(trialEndsAt);
  const expired = days === 0;

  return (
    <section
      className={`rounded-[2px] p-5 space-y-4 border ${
        expired
          ? "bg-[rgba(241,194,27,0.16)] border-[#8a6d00]/30"
          : "bg-primary/5 border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div
            className="inline-flex items-center gap-2 mb-1.5"
            style={{
              color: expired ? "#8a6d00" : "#0f62fe",
              fontFamily: "var(--font-mono)",
              fontSize: "10.5px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            <Sparkles size={12} strokeWidth={2.5} aria-hidden="true" />
            {expired
              ? "Trial expired"
              : cardOnFile
                ? "Card on file"
                : `Free trial · ${days ?? 0} days left`}
          </div>
          <h2
            style={{
              color: "#1E2A3A",
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
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              lineHeight: 1.55,
            }}
          >
            {expired
              ? "Your trial has ended. Activate the workspace to restore full access."
              : cardOnFile
                ? `First charge of $${totalMonthly.toLocaleString()} on ${chargeDateLabel ?? "the day your trial ends"}, then monthly. Manage or cancel any time from the Stripe portal on this page.`
                : `$0 today. First charge of $${totalMonthly.toLocaleString()} on ${chargeDateLabel ?? "the day your trial ends"}, then monthly. Cancel in one click before then and you pay nothing.`}
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
              color: "#1E2A3A",
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

      {cardOnFile ? null : (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => start(tierId, propertyCount)}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-none transition-colors disabled:opacity-60 disabled:cursor-progress"
            style={{
              backgroundColor: expired ? "#8a6d00" : "#0f62fe",
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
              "Add card"
            )}
          </button>
        </div>
      )}
    </section>
  );
}
