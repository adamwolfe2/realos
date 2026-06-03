import "server-only";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/config";
import { resolveStripeCustomerForProposal } from "./customer-lookup";
import { computeProposalTotalsFromRow } from "./totals";
import {
  MAX_PRICE_CENTS,
  MAX_QUANTITY,
} from "./constants";
import type { ProposalWithLines } from "./types";

// ---------------------------------------------------------------------------
// Build + create a Stripe Checkout Session for a Proposal acceptance flow.
//
// Mode selection:
//   - Recurring lines present       → mode: 'subscription'
//     - trialDays > 0   → subscription_data.trial_period_days
//   - Recurring lines absent        → mode: 'payment'
//     - One-time lines as line_items
//
// MIXED proposals (recurring + one-time setup fee in the same proposal):
//   Stripe Checkout v20.4 / Clover API removed
//   `subscription_data.add_invoice_items`. Until we move setup fees to a
//   direct Subscriptions API call with SetupIntent + Elements (a follow-up
//   slice), v1 validates that every proposal is either ALL-recurring or
//   ALL-one-time. Operators with a setup-fee-plus-subscription deal split
//   it into two proposals OR fold the setup into the first month's
//   recurring price.
//
// Discounts: header-level coupon, one-shot (per-session), created inline.
// Stripe Checkout's `discounts` param accepts either a `coupon` id or a
// `promotion_code` — we create the coupon with the proposal id baked
// into the lookup_key so re-creation across attempts is idempotent.
//
// Idempotency keys:
//   - Customer:   resolved upstream via resolveStripeCustomerForProposal
//   - Coupon:     `proposal-coupon-${proposalId}-v${checkoutVersion}`
//   - Session:    `proposal-checkout-${proposalId}-v${checkoutVersion}`
//
// `checkoutVersion` lets agency operators "regenerate the checkout link"
// after a price edit — bump the version, the new session is a fresh
// idempotency identity, the old session is naturally orphaned (Stripe
// expires unpaid Checkout sessions on its own cadence).
//
// Tax: `automatic_tax: { enabled: false }` is explicit. When LeaseStack
// onboards an international client we'll flip per-Customer based on
// billing address; not implicit here.
// ---------------------------------------------------------------------------

export type BuildCheckoutSessionArgs = {
  proposal: ProposalWithLines;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSessionResult = {
  session: Stripe.Checkout.Session;
  stripeCustomerId: string;
  checkoutVersion: number;
};

export class ProposalCheckoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalCheckoutValidationError";
  }
}

function assertValidForCheckout(proposal: ProposalWithLines): void {
  if (proposal.lineItems.length === 0) {
    throw new ProposalCheckoutValidationError(
      "Proposal has no line items — add at least one before sending.",
    );
  }
  const hasRecurring = proposal.lineItems.some((l) => l.recurring);
  const hasOneTime = proposal.lineItems.some((l) => !l.recurring);
  if (hasRecurring && !proposal.cadence) {
    throw new ProposalCheckoutValidationError(
      "Proposal has recurring lines but no cadence set. Pick MONTHLY or ANNUAL.",
    );
  }
  // Mixed proposals (recurring + one-time): supported as of 2026-06-03.
  // Stripe Checkout in mode: "subscription" accepts a line_items list
  // that mixes recurring price_data entries (drive the subscription) and
  // one-time price_data entries (added to the first invoice). The one-
  // time setup / sprint fees are billed immediately alongside the
  // first month's recurring charge. See buildMixedLineItems below.
  // Allowed combinations now:
  //   - all-recurring             → mode: "subscription"
  //   - all-one-time              → mode: "payment"
  //   - recurring + one-time      → mode: "subscription" with mixed
  //                                  line_items (one-time → first invoice)
  //
  // Edge: trial_period_days defers the FIRST invoice (which includes
  // the one-time charges) to trial end. For mixed proposals that's
  // usually not what the agency wants — the setup fee is meant to bill
  // up front while the retainer trial runs. Refuse the combination so
  // the operator picks one explicitly.
  if (hasRecurring && hasOneTime && proposal.trialDays > 0) {
    throw new ProposalCheckoutValidationError(
      "Mixed proposals (recurring + one-time) can't include a free trial — " +
        "Stripe defers the one-time charges to trial end, which usually defeats " +
        "the point of a paid setup fee. Either remove the trial or split the " +
        "one-time fees into a separate proposal.",
    );
  }
  for (const line of proposal.lineItems) {
    if (!Number.isFinite(line.unitPriceCents) || line.unitPriceCents < 0) {
      throw new ProposalCheckoutValidationError(
        `Invalid price on line "${line.label}".`,
      );
    }
    if (line.unitPriceCents > MAX_PRICE_CENTS) {
      throw new ProposalCheckoutValidationError(
        `Line "${line.label}" exceeds the $${(MAX_PRICE_CENTS / 100).toLocaleString()} per-unit cap.`,
      );
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new ProposalCheckoutValidationError(
        `Invalid quantity on line "${line.label}".`,
      );
    }
    if (line.quantity > MAX_QUANTITY) {
      throw new ProposalCheckoutValidationError(
        `Line "${line.label}" exceeds the ${MAX_QUANTITY}-unit quantity cap.`,
      );
    }
  }
}

/** Stripe wants the recurring interval as a string; we map our enum. */
function intervalFor(cadence: "MONTHLY" | "ANNUAL"): "month" | "year" {
  return cadence === "ANNUAL" ? "year" : "month";
}

/** Build the recurring `line_items` from the proposal lines. Each entry
 *  uses inline `price_data` so per-line overrides round-trip without
 *  creating disposable Stripe Prices. */
function buildRecurringLineItems(
  proposal: ProposalWithLines,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const interval = intervalFor(proposal.cadence ?? "MONTHLY");
  return proposal.lineItems
    .filter((l) => l.recurring)
    .map((l) => ({
      quantity: Math.max(1, Math.floor(l.quantity)),
      price_data: {
        currency: proposal.currency,
        unit_amount: Math.max(0, Math.floor(l.unitPriceCents)),
        recurring: { interval },
        product_data: {
          name: l.label,
          ...(l.description ? { description: l.description } : {}),
          metadata: {
            proposalLineId: l.id,
            proposalLineKind: l.kind,
            ...(l.catalogItemId ? { catalogItemId: l.catalogItemId } : {}),
          },
        },
      },
    }));
}

/** Build the one-time top-level `line_items` for PAYMENT mode (no sub). */
function buildOneTimeLineItems(
  proposal: ProposalWithLines,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return proposal.lineItems
    .filter((l) => !l.recurring)
    .map((l) => ({
      quantity: Math.max(1, Math.floor(l.quantity)),
      price_data: {
        currency: proposal.currency,
        unit_amount: Math.max(0, Math.floor(l.unitPriceCents)),
        product_data: {
          name: l.label,
          ...(l.description ? { description: l.description } : {}),
          metadata: {
            proposalLineId: l.id,
            proposalLineKind: l.kind,
            ...(l.catalogItemId ? { catalogItemId: l.catalogItemId } : {}),
          },
        },
      },
    }));
}

/** Build the full `line_items` list for a MIXED proposal under
 *  subscription mode. Recurring entries drive the subscription;
 *  one-time entries (no `recurring` block in their price_data) are
 *  added by Stripe to the first invoice automatically. This is the
 *  current Stripe Checkout supported pattern for setup-fee-plus-
 *  subscription deals; lets a "Kickoff + Implementation Sprint +
 *  Monthly Retainer + White-Glove" proposal collect both halves in
 *  one Checkout session. */
function buildMixedLineItems(
  proposal: ProposalWithLines,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const interval = intervalFor(proposal.cadence ?? "MONTHLY");
  return proposal.lineItems.map((l) => ({
    quantity: Math.max(1, Math.floor(l.quantity)),
    price_data: {
      currency: proposal.currency,
      unit_amount: Math.max(0, Math.floor(l.unitPriceCents)),
      // Only attach `recurring` for actually-recurring lines; absence of
      // the `recurring` block is what tells Stripe to treat a price as
      // one-time and roll it into the first invoice.
      ...(l.recurring ? { recurring: { interval } } : {}),
      product_data: {
        name: l.label,
        ...(l.description ? { description: l.description } : {}),
        metadata: {
          proposalLineId: l.id,
          proposalLineKind: l.kind,
          recurring: l.recurring ? "true" : "false",
          ...(l.catalogItemId ? { catalogItemId: l.catalogItemId } : {}),
        },
      },
    },
  }));
}

/** Create (idempotently) a one-shot coupon for the proposal's header
 *  discount, return the coupon id. Returns null if no discount. */
async function maybeCreateCoupon(
  proposal: ProposalWithLines,
  checkoutVersion: number,
): Promise<string | null> {
  if (!proposal.discountAmountCents || proposal.discountAmountCents <= 0) {
    return null;
  }
  const stripe = getStripeClient();
  const lookupKey = `proposal-coupon-${proposal.id}-v${checkoutVersion}`;
  try {
    const coupon = await stripe.coupons.create(
      {
        amount_off: proposal.discountAmountCents,
        currency: proposal.currency,
        duration: "once",
        name: proposal.discountReason || "Proposal discount",
        metadata: {
          proposalId: proposal.id,
          checkoutVersion: String(checkoutVersion),
          discountScope: proposal.discountScope,
        },
      },
      { idempotencyKey: lookupKey },
    );
    return coupon.id;
  } catch (err) {
    // Stripe errors on idempotency-key + amount mismatch happen if we
    // regenerate after changing the discount without bumping checkoutVersion.
    // Surface clearly so the operator can bump the version. Preserve the
    // original Stripe error in `cause` so Sentry's stack-chain export
    // shows the underlying Stripe error code + request id.
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to create coupon for proposal ${proposal.id}: ${message}. ` +
        `If you edited the discount, bump checkoutVersion.`,
      { cause: err instanceof Error ? err : new Error(message) },
    );
  }
}

export async function createCheckoutSessionForProposal(
  args: BuildCheckoutSessionArgs,
): Promise<CheckoutSessionResult> {
  assertValidForCheckout(args.proposal);
  const { proposal } = args;
  const stripe = getStripeClient();

  // Customer first — every downstream call attaches to this id.
  const customer = await resolveStripeCustomerForProposal({
    proposalId: proposal.id,
    prospectEmail: proposal.prospectEmail,
    prospectName: proposal.prospectName,
    prospectCompany: proposal.prospectCompany,
    prospectOrgId: proposal.prospectOrgId,
  });

  const checkoutVersion = proposal.checkoutVersion;
  const totals = computeProposalTotalsFromRow(proposal);
  const hasRecurring = totals.recurringSubtotal > 0;
  const hasOneTime = totals.oneTimeSubtotal > 0;
  const isMixed = hasRecurring && hasOneTime;
  const couponId = await maybeCreateCoupon(proposal, checkoutVersion);

  const baseMetadata: Stripe.MetadataParam = {
    proposalId: proposal.id,
    proposalNumber: proposal.number,
    kind: "proposal",
    checkoutVersion: String(checkoutVersion),
  };

  // Common params across both modes.
  const common: Pick<
    Stripe.Checkout.SessionCreateParams,
    | "customer"
    | "metadata"
    | "success_url"
    | "cancel_url"
    | "automatic_tax"
    | "billing_address_collection"
    | "allow_promotion_codes"
    | "discounts"
  > = {
    customer: customer.stripeCustomerId,
    metadata: baseMetadata,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    automatic_tax: { enabled: false },
    billing_address_collection: "auto",
    // Agency-issued proposals already include any discount in the line
    // items + coupon — disable customer-entered promotion codes so the
    // prospect can't stack a marketing coupon on top of an agency price.
    allow_promotion_codes: false,
    ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
  };

  let params: Stripe.Checkout.SessionCreateParams;

  if (hasRecurring) {
    // SUBSCRIPTION mode. Mixed proposals (recurring + one-time) use the
    // buildMixedLineItems helper so one-time charges land on the first
    // invoice alongside the first month's recurring charge. Pure-
    // recurring proposals use buildRecurringLineItems unchanged.
    params = {
      ...common,
      mode: "subscription",
      line_items: isMixed
        ? buildMixedLineItems(proposal)
        : buildRecurringLineItems(proposal),
      subscription_data: {
        metadata: baseMetadata,
        ...(proposal.trialDays > 0
          ? { trial_period_days: proposal.trialDays }
          : {}),
      },
    };
  } else {
    // PAYMENT mode — one-time only.
    params = {
      ...common,
      mode: "payment",
      line_items: buildOneTimeLineItems(proposal),
      payment_intent_data: {
        metadata: baseMetadata,
      },
    };
  }

  const session = await stripe.checkout.sessions.create(params, {
    idempotencyKey: `proposal-checkout-${proposal.id}-v${checkoutVersion}`,
  });

  return {
    session,
    stripeCustomerId: customer.stripeCustomerId,
    checkoutVersion,
  };
}
