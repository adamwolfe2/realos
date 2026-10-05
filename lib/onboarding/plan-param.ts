import type { SubscriptionTier } from "@prisma/client";

// Plan picked on /pricing, carried /sign-up -> /auth/redirect -> /onboarding
// so the feature cart opens on that package instead of the default.
const PLANS = { starter: "STARTER", growth: "GROWTH", scale: "SCALE" } as const;
export type PlanParam = keyof typeof PLANS;

export function parsePlanParam(v: unknown): PlanParam | null {
  return typeof v === "string" && Object.hasOwn(PLANS, v) ? (v as PlanParam) : null;
}

export function tierForPlan(plan: PlanParam): SubscriptionTier {
  return PLANS[plan];
}
