import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Trial banner. Renders at the top of every portal page when the
// workspace is in the TRIALING subscription state. Shows:
//   * how many days are left
//   * a CTA to activate the subscription early
//
// Hidden completely outside the trial window (paid, paused, canceled
// states get their own banners elsewhere).

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
}: {
  trialEndsAt: Date;
  propertyCount: number;
  // Accept the full SubscriptionTier enum so the layout can pass any of
  // the four valid values; we only render a friendly label for the
  // three public tiers and fall back to "your plan" otherwise.
  tier: "STARTER" | "GROWTH" | "SCALE" | "CUSTOM" | null;
}) {
  const now = new Date();
  const daysLeft = daysLeftBetween(now, trialEndsAt);
  const expired = daysLeft === 0;

  // Friendly tier label for the inline cost line.
  const tierLabel =
    tier === "STARTER"
      ? "Foundation"
      : tier === "GROWTH"
        ? "Growth"
        : tier === "SCALE"
          ? "Scale"
          : null;

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
        <span className="truncate">
          {expired ? (
            <>
              <strong>Your trial ended.</strong> Activate your subscription
              to keep using your workspace.
            </>
          ) : (
            <>
              <strong>
                {daysLeft} day{daysLeft === 1 ? "" : "s"} left
              </strong>{" "}
              in your free trial
              {tierLabel ? ` of ${tierLabel}` : ""}
              {propertyCount > 0
                ? ` · ${propertyCount} ${propertyCount === 1 ? "property" : "properties"}`
                : ""}
            </>
          )}
        </span>
      </div>
      {/* Flat 0-radius CTA — same treatment as the PageHeader action /
          dashboard range-pill controls and the AppFolio "Connect" CTA
          (components/portal/attribution/range-preset-control.tsx,
          appfolio-status-banner.tsx), not a rounded-full pill. */}
      <Link
        href="/portal/billing"
        className={cn(
          "shrink-0 inline-flex items-center rounded-none transition-colors px-3 py-1.5 text-xs font-semibold",
          expired
            ? "bg-[#8a6d00] text-white hover:bg-[#6f5800]"
            : "bg-primary text-primary-foreground hover:bg-primary-dark",
        )}
      >
        {expired ? "Activate now" : "Activate subscription"}
      </Link>
    </div>
  );
}
