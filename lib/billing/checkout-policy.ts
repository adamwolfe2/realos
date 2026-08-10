import "server-only";
import { createHash } from "node:crypto";
import { UserRole } from "@prisma/client";
import { isFeatureKey, type FeatureKey } from "@/lib/billing/features";

type BillingScope = {
  role: UserRole;
  isAgency: boolean;
  isImpersonating: boolean;
};

const AGENCY_BILLING_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
]);

export function canManageBilling(scope: BillingScope): boolean {
  if (scope.role === UserRole.CLIENT_OWNER) return true;
  return (
    scope.isAgency &&
    scope.isImpersonating &&
    AGENCY_BILLING_ROLES.has(scope.role)
  );
}

export function canonicalFeatureKeys(keys: readonly string[]): FeatureKey[] {
  return Array.from(new Set(keys.filter(isFeatureKey))).sort() as FeatureKey[];
}

type StripeTrialSchedule =
  | { trial_end: number }
  | { trial_period_days: number }
  | Record<string, never>;

const STRIPE_MIN_EXACT_TRIAL_MS = 48 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function stripeTrialSchedule(
  trialEndsAt: Date | null,
  now = new Date(),
): StripeTrialSchedule {
  if (!trialEndsAt) return {};
  const remainingMs = trialEndsAt.getTime() - now.getTime();
  if (remainingMs <= 0) return {};
  if (remainingMs >= STRIPE_MIN_EXACT_TRIAL_MS) {
    return { trial_end: Math.floor(trialEndsAt.getTime() / 1000) };
  }
  return { trial_period_days: Math.max(1, Math.ceil(remainingMs / DAY_MS)) };
}

type CheckoutIdentity = {
  orgId: string;
  tierId: string;
  cycle: string;
  propertyCount: number;
  featureKeys: readonly string[];
  priceIds: readonly string[];
  trialEndsAt: Date | null;
};

export function billingCheckoutIdempotencyKey(
  identity: CheckoutIdentity,
): string {
  const cart = JSON.stringify({
    orgId: identity.orgId,
    tierId: identity.tierId,
    cycle: identity.cycle,
    propertyCount: identity.propertyCount,
    featureKeys: canonicalFeatureKeys(identity.featureKeys),
    priceIds: [...identity.priceIds].sort(),
    trialEndsAt: identity.trialEndsAt?.toISOString() ?? null,
  });
  const digest = createHash("sha256").update(cart).digest("hex").slice(0, 24);
  return `co_${identity.orgId}_${digest}`;
}
