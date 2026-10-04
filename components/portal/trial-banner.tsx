import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddCardButton } from "@/components/portal/billing/add-card-button";
import {
  formatChargeDate,
  formatUsd,
  type TrialQuote,
} from "@/lib/billing/trial-quote";

// Trial banner. Renders at the top of every portal page when the
// workspace is TRIALING. Go-live trial states (plans/go-live-trial):
//   * not live yet: the 14-day clock starts at go-live, set up by <date>
//   * live, no card: "$0 today, first charge of $X on <date>" + Add card
//   * card on file: first charge amount/date + manage/cancel link
//   * expired, no card: chatbot + pixel paused, data stays, Reactivate
// Hidden outside the trial (paid, paused, canceled have their own banners).

function daysLeftBetween(now: Date, end: Date): number {
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return 0;
  // Round UP so "0.4 days left" reads as "1 day" — feels more honest
  // than rounding to zero when there's still a sliver of trial.
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function TrialBanner({
  trialEndsAt,
  propertyCount,
  tier,
  live,
  cardOnFile,
  quote,
  canManageBilling,
}: {
  trialEndsAt: Date;
  propertyCount: number;
  // Accept the full SubscriptionTier enum so the layout can pass any of
  // the four valid values; we only render a friendly label for the
  // three public tiers and fall back to "your plan" otherwise.
  tier: "STARTER" | "GROWTH" | "SCALE" | "CUSTOM" | null;
  // Go-live trial (plans/go-live-trial): the 14-day clock started.
  live: boolean;
  // A Stripe subscription is scheduled to bill at trial end.
  cardOnFile: boolean;
  quote: TrialQuote | null;
  canManageBilling: boolean;
}) {
  const now = new Date();
  const daysLeft = daysLeftBetween(now, trialEndsAt);
  // A card-on-file trial past its end is waiting on Stripe's first invoice,
  // not lapsed: keep showing the card-on-file state.
  const expired = daysLeft === 0 && !cardOnFile;
  const chargeDate = formatChargeDate(trialEndsAt);
  const charge = quote ? formatUsd(quote.monthlyCents) : null;
  const canAddCard = canManageBilling && quote !== null && !cardOnFile;

  // Friendly tier label for the inline cost line.
  const tierLabel =
    tier === "STARTER"
      ? "Foundation"
      : tier === "GROWTH"
        ? "Growth"
        : tier === "SCALE"
          ? "Scale"
          : null;

  // Soft landing (slice 4): expired + no card pauses the chatbot and pixel
  // only; everything already collected stays readable.
  const message = expired ? (
    <>
      <strong>Your trial ended, nothing was charged.</strong> Your data is still
      here (read-only); chatbot and pixel are paused.
      {charge ? ` Reactivate for ${charge}/month, starting today.` : ""}
    </>
  ) : cardOnFile ? (
    <>
      <strong>Card on file.</strong>{" "}
      {charge ? `First charge of ${charge} on ${chargeDate}.` : `Your plan starts ${chargeDate}.`}
    </>
  ) : live ? (
    <>
      <strong>You&apos;re live.</strong> Add a card to keep everything running
      after {chargeDate}.{" "}
      {charge
        ? `$0 today, first charge of ${charge} on ${chargeDate}, cancel in one click.`
        : "$0 today, cancel in one click."}
    </>
  ) : (
    <>
      <strong>Your 14-day trial starts when you go live</strong>
      {tierLabel ? ` on ${tierLabel}` : ""}
      {propertyCount > 0
        ? ` · ${propertyCount} ${propertyCount === 1 ? "property" : "properties"}`
        : ""}
      {` · set up by ${chargeDate}`}
    </>
  );

  const ctaClass = expired
    ? "bg-[#8a6d00] text-white hover:bg-[#6f5800]"
    : "bg-primary text-primary-foreground hover:bg-primary-dark";

  // Tone classes use the Carbon kit warning family (#f1c21b wash / #8a6d00
  // text — same pair as .ls-pill-warning/.ls-alert-warning in globals.css
  // and StatusChip's stale state), not Tailwind amber; active reuses brand
  // primary.
  return (
    <div
      role="status"
      className={cn(
        "shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 text-xs border-b",
        expired
          ? "bg-[rgba(241,194,27,0.10)] border-[rgba(241,194,27,0.30)] text-[#8a6d00]"
          : "bg-primary/10 border-primary/30 text-primary",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles
          size={14}
          strokeWidth={2.5}
          className={cn("shrink-0", expired ? "text-[#8a6d00]" : "text-primary")}
          aria-hidden="true"
        />
        <span className="truncate">{message}</span>
      </div>
      {/* Flat 0-radius CTA — same treatment as the PageHeader action /
          dashboard range-pill controls and the AppFolio "Connect" CTA
          (components/portal/attribution/range-preset-control.tsx,
          appfolio-status-banner.tsx), not a rounded-full pill. */}
      <div className="shrink-0 flex items-center gap-3">
        {expired || cardOnFile ? null : (
          <a
            href={process.env.NEXT_PUBLIC_CAL_BOOK_URL || "/book-demo"}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline font-semibold underline-offset-4 hover:underline"
          >
            Book a setup call
          </a>
        )}
        {cardOnFile ? (
          <Link
            href="/portal/billing"
            className="shrink-0 font-semibold underline-offset-4 hover:underline"
          >
            Manage or cancel
          </Link>
        ) : canAddCard && quote ? (
          <AddCardButton
            tierId={quote.tierId}
            propertyCount={quote.propertyCount}
            label={expired ? "Reactivate" : "Add card"}
            className={ctaClass}
          />
        ) : (
          <Link
            href="/portal/billing"
            className={cn(
              "shrink-0 inline-flex items-center rounded-none transition-colors px-3 py-1.5 text-xs font-semibold",
              ctaClass,
            )}
          >
            {expired ? "Reactivate" : "Activate subscription"}
          </Link>
        )}
      </div>
    </div>
  );
}
