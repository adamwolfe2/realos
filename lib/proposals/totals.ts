import "server-only";
import type {
  DiscountScope,
  LineItemInput,
  Proposal,
  ProposalLineItem,
  ProposalTotalsCents,
  ProposalWithLines,
} from "./types";
import { isDiscountScope } from "./types";
import {
  computeSubtotalsCentsShared,
  allocateDiscountCentsShared,
  computeProposalTotalsShared,
  type DiscountScopeShared,
  type LineLikeShared,
} from "./totals-shared";

// ---------------------------------------------------------------------------
// Proposal totals math — server-side wrapper.
//
// All the arithmetic lives in `./totals-shared.ts` (client-safe, no
// Prisma types, no server-only). This file re-exports those helpers
// under Prisma-typed signatures so server callers don't have to
// re-shape their data into the shared types.
//
// Why two files?
//   - `lib/proposals/totals-shared.ts` is the math, importable from
//     React Server Components, client components, server actions —
//     anywhere. No "server-only" gate.
//   - `lib/proposals/totals.ts` (this file) is "server-only" because
//     it accepts Prisma model types. The composer UI uses the shared
//     module directly; the Stripe + PDF + save paths use this one.
//
// Single source of truth for "what does this proposal cost?". Called from:
//   - Admin builder UI (live totals in the composer footer — via shared)
//   - Save path (writes recurringSubtotal + oneTimeSubtotal to the
//     Proposal row so the list view doesn't aggregate per render)
//   - Stripe checkout builder (decides subscription vs payment mode +
//     attaches one-time setup fees as add_invoice_items)
//   - PDF document (renders the price summary)
//
// All inputs are integers in cents — never floats — to avoid the classic
// JS float-rounding bug on cumulative addition. Stripe also requires
// integer cents on every price_data.unit_amount.
// ---------------------------------------------------------------------------

type LineLike = Pick<
  ProposalLineItem | LineItemInput,
  "unitPriceCents" | "quantity" | "recurring"
> & {
  quantity?: number | null;
  recurring?: boolean | null;
};

type ProposalHeader = Pick<
  Proposal,
  "cadence" | "trialDays" | "discountAmountCents" | "discountScope"
>;

function toSharedLine(line: LineLike): LineLikeShared {
  return {
    unitPriceCents: line.unitPriceCents,
    quantity: line.quantity ?? null,
    recurring: line.recurring ?? null,
  };
}

/** Sum recurring vs one-time. Returns raw subtotals (no discount applied). */
export function computeSubtotalsCents(lines: ReadonlyArray<LineLike>): {
  recurring: number;
  oneTime: number;
} {
  return computeSubtotalsCentsShared(lines.map(toSharedLine));
}

/** Allocate the proposal's header-level discount across recurring + one-time
 *  buckets based on `scope`. Clamps at the subtotal so a $5,000 discount on
 *  a $3,000 subtotal becomes $3,000 — never negative.
 *
 *  `both` allocates pro-rata against subtotals so a 50/50 split of a $200
 *  discount across $800 recurring + $200 one-time becomes $160 recurring +
 *  $40 one-time. This keeps "discount applied to recurring" and "discount
 *  applied to one-time" semantically meaningful when the operator picked
 *  `both` to mean "spread it sensibly".
 */
export function allocateDiscountCents(args: {
  recurringSubtotal: number;
  oneTimeSubtotal: number;
  discountAmount: number;
  scope: DiscountScope;
}): { recurring: number; oneTime: number } {
  // DiscountScope and DiscountScopeShared are the same string union;
  // the cast is safe and avoids re-typing both layers.
  return allocateDiscountCentsShared({
    recurringSubtotal: args.recurringSubtotal,
    oneTimeSubtotal: args.oneTimeSubtotal,
    discountAmount: args.discountAmount,
    scope: args.scope as DiscountScopeShared,
  });
}

/** Compute the full totals breakdown for a proposal + its lines. Pure. */
export function computeProposalTotalsCents(
  proposal: ProposalHeader,
  lines: ReadonlyArray<LineLike>,
): ProposalTotalsCents {
  const scopeRaw = proposal.discountScope ?? "both";
  const scope: DiscountScope = isDiscountScope(scopeRaw) ? scopeRaw : "both";
  // computeProposalTotalsShared returns the same shape as ProposalTotalsCents
  // (verified by the test harness). The cast is the unification point —
  // this is the ONE place we admit shared ↔ Prisma type equivalence.
  return computeProposalTotalsShared(
    {
      cadence: proposal.cadence,
      trialDays: proposal.trialDays ?? 0,
      discountAmountCents: proposal.discountAmountCents ?? 0,
      discountScope: scope,
    },
    lines.map(toSharedLine),
  ) as ProposalTotalsCents;
}

/** Convenience: take a fully-loaded ProposalWithLines and return totals. */
export function computeProposalTotalsFromRow(
  row: ProposalWithLines,
): ProposalTotalsCents {
  return computeProposalTotalsCents(row, row.lineItems);
}
