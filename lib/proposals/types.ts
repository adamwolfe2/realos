import "server-only";
import type {
  Proposal,
  ProposalCadence,
  ProposalCatalogItem,
  ProposalLineItem,
  ProposalLineKind,
  ProposalStatus,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Type surface for the proposal builder.
//
// Re-export Prisma model types so the rest of the lib doesn't have to import
// from `@prisma/client` directly — and so we can ergonomically derive
// composite types (Proposal + lines, totals breakdown, etc.) without
// polluting downstream files with Prisma's verbose generic helpers.
// ---------------------------------------------------------------------------

export type {
  Proposal,
  ProposalCadence,
  ProposalCatalogItem,
  ProposalLineItem,
  ProposalLineKind,
  ProposalStatus,
};

/** Discount scope. Stored as a String on Proposal to avoid a 3-value enum. */
export type DiscountScope = "recurring" | "one_time" | "both";

export function isDiscountScope(value: string): value is DiscountScope {
  return value === "recurring" || value === "one_time" || value === "both";
}

/** A proposal with its line items eagerly loaded. The canonical shape every
 *  pricing / Stripe / PDF call expects. */
export type ProposalWithLines = Proposal & {
  lineItems: ProposalLineItem[];
};

/** Totals breakdown for a proposal. All values in CENTS, never floats.
 *  - recurringSubtotal / oneTimeSubtotal: raw sum of lines (NO discount applied).
 *  - recurringDiscount / oneTimeDiscount: portion of `proposal.discountAmountCents`
 *    allocated to each bucket based on `proposal.discountScope`.
 *  - recurringTotal / oneTimeTotal: post-discount amounts.
 *  - firstInvoiceTotal: what the prospect pays AT checkout — recurring (if no
 *    trial) + one-time, both net of discount. Trials shift recurring out of
 *    the first invoice.
 */
export type ProposalTotalsCents = {
  recurringSubtotal: number;
  recurringDiscount: number;
  recurringTotal: number;
  oneTimeSubtotal: number;
  oneTimeDiscount: number;
  oneTimeTotal: number;
  firstInvoiceTotal: number;
  hasTrial: boolean;
  trialDays: number;
  cadence: ProposalCadence | null;
};

/** Input shape for `addLine` / `replaceLines` — mirrors the persisted shape
 *  but omits server-managed fields. */
export type LineItemInput = {
  kind: ProposalLineKind;
  catalogItemId?: string | null;
  label: string;
  description?: string | null;
  unitPriceCents: number;
  quantity?: number;
  recurring?: boolean;
  sortOrder?: number;
};

/** Result of the customer lookup chain.
 *  `origin` records WHICH branch matched so audit logs can verify behavior.
 */
export type CustomerLookupResult = {
  stripeCustomerId: string;
  origin: "prospect_org" | "prior_proposal" | "stripe_search" | "created";
};
