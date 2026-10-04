import Stripe from "stripe";
import { prisma } from "@/lib/db";

type OrgForCustomer = {
  id: string;
  name: string;
  primaryContactEmail: string | null;
  stripeCustomerId: string | null;
};

/**
 * customers.create params for an org's platform Stripe customer. Built from
 * org data only (never the caller's email) so every route sending the shared
 * `cust_${org.id}` idempotency key sends identical params; Stripe rejects a
 * reused key with different params.
 */
export function orgCustomerCreateParams(
  org: OrgForCustomer,
): Stripe.CustomerCreateParams {
  return {
    email: org.primaryContactEmail ?? undefined,
    name: org.name,
    metadata: { org_id: org.id },
  };
}

/**
 * Returns the org's Stripe customer id, creating and linking one if needed.
 * Shared by /api/billing/checkout and /api/billing/website-build so both
 * converge on one customer. On an idempotency conflict (key reused with
 * different params, e.g. org renamed mid-flight) the other request's link
 * wins if it landed; otherwise the error propagates.
 */
export async function ensureOrgStripeCustomer(
  stripe: Stripe,
  org: OrgForCustomer,
): Promise<string> {
  if (org.stripeCustomerId) return org.stripeCustomerId;
  try {
    const customer = await stripe.customers.create(
      orgCustomerCreateParams(org),
      { idempotencyKey: `cust_${org.id}` },
    );
    await prisma.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  } catch (err) {
    if (!(err instanceof Stripe.errors.StripeIdempotencyError)) throw err;
    const linked = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { stripeCustomerId: true },
    });
    if (linked?.stripeCustomerId) return linked.stripeCustomerId;
    throw err;
  }
}
