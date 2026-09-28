import type { SubscriptionTier } from "@prisma/client";
import {
  TIERS,
  computeGraduatedMonthlyCents,
} from "@/lib/billing/catalog";

// ---------------------------------------------------------------------------
// What the trial will cost when it converts. One source for the banner,
// the billing card, and the reminder emails so every surface quotes the
// number /api/billing/checkout bills: the org's tier graduated price x the
// IMPORTED+ACTIVE property count (min 1).
// ---------------------------------------------------------------------------

export const BILLABLE_LIFECYCLES = ["IMPORTED", "ACTIVE"] as const;

export type TrialQuote = {
  tierId: "starter" | "growth" | "scale";
  planName: "Foundation" | "Growth" | "Scale";
  propertyCount: number;
  monthlyCents: number;
};

const PLAN_NAMES = {
  starter: "Foundation",
  growth: "Growth",
  scale: "Scale",
} as const;

export function trialQuote(
  tier: SubscriptionTier | null,
  rawPropertyCount: number,
): TrialQuote | null {
  const def = TIERS.find((t) => t.tier === tier);
  if (!def) return null;
  const tierId = def.id as TrialQuote["tierId"];
  const propertyCount = Math.max(1, rawPropertyCount);
  return {
    tierId,
    planName: PLAN_NAMES[tierId],
    propertyCount,
    monthlyCents: computeGraduatedMonthlyCents(
      def.monthly.unitAmountCents,
      propertyCount,
    ),
  };
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

// Charge dates render in US Pacific: the latest US zone, so the calendar
// date shown is never after the moment Stripe actually charges for any US
// customer.
export function formatChargeDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });
}
