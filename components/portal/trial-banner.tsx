import Link from "next/link";
import { Sparkles } from "lucide-react";

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

  return (
    <div
      role="status"
      className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
      style={{
        backgroundColor: expired
          ? "rgba(217, 119, 6, 0.10)"
          : "rgba(37,99,235,0.06)",
        borderBottom: expired
          ? "1px solid rgba(217, 119, 6, 0.30)"
          : "1px solid rgba(37,99,235,0.18)",
        color: expired ? "#92400e" : "#1e3a8a",
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles
          size={14}
          strokeWidth={2.5}
          className="shrink-0"
          style={{ color: expired ? "#92400e" : "#2563EB" }}
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
      <Link
        href="/portal/billing"
        className="shrink-0 inline-flex items-center rounded-full font-semibold transition-colors"
        style={{
          backgroundColor: expired ? "#92400e" : "#2563EB",
          color: "#ffffff",
          padding: "5px 12px",
          fontSize: "11.5px",
          letterSpacing: "0.02em",
        }}
      >
        {expired ? "Activate now" : "Activate subscription"}
      </Link>
    </div>
  );
}
