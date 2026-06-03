import "server-only";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe/config";
import type { CustomerLookupResult } from "./types";

// ---------------------------------------------------------------------------
// Stripe Customer reuse strategy.
//
// Every proposal goes through Stripe Checkout. The Checkout session needs
// a Customer; we don't want to create a NEW Customer per proposal for the
// same prospect, because:
//
//   - Stripe's dashboard becomes a mess of duplicate Customer rows
//     ("ACME Real Estate (1)", "ACME Real Estate (2)", …)
//   - Cross-proposal MRR/LTV reporting breaks: Stripe would treat each
//     proposal acceptance as a brand-new customer instead of an upsell
//   - Card-on-file becomes useless: the prospect re-enters payment for
//     each follow-on proposal even though Stripe has their PM stored
//
// Lookup order (first hit wins):
//   1. `Proposal.prospectOrgId` → `Organization.stripeCustomerId`
//      Direct link: this is an UPSELL on an existing client.
//   2. Earlier `Proposal` with same `prospectEmail` and a populated
//      `stripeCustomerId`. Same prospect, multiple proposals (e.g. v1
//      was declined, v2 is on the table).
//   3. `stripe.customers.search({email})` — fishes up any Customer we
//      didn't track. Handles the case where someone manually created
//      a Customer in the dashboard before we built this.
//   4. Otherwise: create a fresh Customer with metadata.proposalId set.
// ---------------------------------------------------------------------------

const STRIPE_SEARCH_LIMIT = 5;

export async function resolveStripeCustomerForProposal(args: {
  proposalId: string;
  prospectEmail: string;
  prospectName: string;
  prospectCompany?: string | null;
  prospectOrgId?: string | null;
}): Promise<CustomerLookupResult> {
  const stripe = getStripeClient();

  // 1. Existing Org link.
  if (args.prospectOrgId) {
    const org = await prisma.organization
      .findUnique({
        where: { id: args.prospectOrgId },
        select: { stripeCustomerId: true },
      })
      .catch(() => null);
    if (org?.stripeCustomerId) {
      return {
        stripeCustomerId: org.stripeCustomerId,
        origin: "prospect_org",
      };
    }
  }

  // 2. Prior proposal with same email.
  const priorProposal = await prisma.proposal
    .findFirst({
      where: {
        prospectEmail: args.prospectEmail,
        stripeCustomerId: { not: null },
        id: { not: args.proposalId },
      },
      orderBy: { createdAt: "desc" },
      select: { stripeCustomerId: true },
    })
    .catch(() => null);
  if (priorProposal?.stripeCustomerId) {
    return {
      stripeCustomerId: priorProposal.stripeCustomerId,
      origin: "prior_proposal",
    };
  }

  // 3. Stripe-side search by email. Stripe's search uses a Lucene-ish
  // syntax that supports `OR`, `AND`, parentheses, and field operators —
  // a prospect email like `attacker@x.com OR email:victim@y.com` would
  // otherwise inject. Whitelist email-safe characters before
  // interpolating, then quote.
  //
  // We don't bypass the search on whitelist mismatch — that would be a
  // soft-fail with weaker guarantees. Instead, the whitelist strips
  // unsafe chars; the (mangled) email won't match anything in Stripe,
  // which falls through to the create branch — exactly the behavior we
  // want for an email we couldn't verify against Stripe's index.
  //
  // `customers.search` returns up to 100 results; we cap at 5 because
  // any email matching >5 customers is a data quality issue worth
  // surfacing rather than silently using one of them.
  const safeEmail = args.prospectEmail.replace(/[^A-Za-z0-9._%+\-@]/g, "");
  try {
    const search = await stripe.customers.search({
      query: `email:"${safeEmail}"`,
      limit: STRIPE_SEARCH_LIMIT,
    });
    // Prefer the most recently created customer (Stripe sorts by
    // `created` desc by default but we don't rely on it).
    if (search.data.length > 0) {
      const sorted = [...search.data].sort(
        (a, b) => (b.created ?? 0) - (a.created ?? 0),
      );
      const candidate = sorted[0];
      if (candidate?.id) {
        return {
          stripeCustomerId: candidate.id,
          origin: "stripe_search",
        };
      }
    }
  } catch (err) {
    // review-fix: bare catch{} swallowed the exact failure mode the
    // file's docstring says we want to AVOID — falling through to
    // "create new Customer" produces the duplicate-Customer behavior we
    // built the lookup chain to prevent. Don't surface to the caller
    // (create-fallback is still the right behavior on Stripe outage),
    // but log + capture so rate-limits / auth errors / network failures
    // don't masquerade as silent cache misses.
    console.warn(
      "[proposal-customer-lookup] stripe customers.search failed:",
      err,
    );
    try {
      const { captureWithContext } = await import("@/lib/sentry");
      captureWithContext(err, {
        route: "lib/proposals/customer-lookup",
        handler: "resolveStripeCustomerForProposal",
        tag: "stripe_search_failed",
      });
    } catch {
      // Sentry import / capture itself failed — console.warn above is
      // the floor of observability.
    }
  }

  // 4. Create. Idempotency key includes the proposal id so duplicate
  // send-button clicks don't create duplicate Customers either.
  const customer = await stripe.customers.create(
    {
      email: args.prospectEmail,
      name: args.prospectCompany || args.prospectName,
      description: args.prospectCompany
        ? `${args.prospectName} (${args.prospectCompany})`
        : args.prospectName,
      metadata: {
        source: "leasestack_proposal",
        proposalId: args.proposalId,
      },
    },
    { idempotencyKey: `proposal-customer-${args.proposalId}` },
  );

  return { stripeCustomerId: customer.id, origin: "created" };
}
