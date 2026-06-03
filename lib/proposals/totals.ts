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

// ---------------------------------------------------------------------------
// Proposal totals math.
//
// Single source of truth for "what does this proposal cost?". Called from:
//   - Admin builder UI (live totals in the composer footer)
//   - Save path (writes recurringSubtotalCents + oneTimeSubtotalCents to
//     the Proposal row so the list view doesn't aggregate per render)
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

function safeQuantity(q: number | null | undefined): number {
  if (typeof q !== "number" || !Number.isFinite(q) || q <= 0) return 1;
  return Math.floor(q);
}

function safeRecurring(r: boolean | null | undefined): boolean {
  // Defaults to true to match the schema default. The composer always passes
  // a value explicitly; defaulting matters only for tests + legacy callers.
  return r !== false;
}

/** Sum recurring vs one-time. Returns raw subtotals (no discount applied). */
export function computeSubtotalsCents(lines: ReadonlyArray<LineLike>): {
  recurring: number;
  oneTime: number;
} {
  let recurring = 0;
  let oneTime = 0;
  for (const line of lines) {
    const qty = safeQuantity(line.quantity);
    // Guard NaN / Infinity explicitly — Math.max(0, NaN) returns NaN, which
    // would poison the running sum. Treat any non-finite price as 0.
    const raw = Number(line.unitPriceCents);
    const safePrice = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    const amount = safePrice * qty;
    if (safeRecurring(line.recurring)) {
      recurring += amount;
    } else {
      oneTime += amount;
    }
  }
  return { recurring, oneTime };
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
  const { recurringSubtotal, oneTimeSubtotal, scope } = args;
  const discount = Math.max(0, Math.floor(args.discountAmount));
  if (discount === 0) return { recurring: 0, oneTime: 0 };

  if (scope === "recurring") {
    return { recurring: Math.min(discount, recurringSubtotal), oneTime: 0 };
  }
  if (scope === "one_time") {
    return { recurring: 0, oneTime: Math.min(discount, oneTimeSubtotal) };
  }
  // scope = both — pro-rata allocation. If either subtotal is zero the
  // discount lands entirely on the non-zero side (with clamp).
  const total = recurringSubtotal + oneTimeSubtotal;
  if (total === 0) return { recurring: 0, oneTime: 0 };
  const cappedDiscount = Math.min(discount, total);
  // Allocate to recurring first (floor) so the remainder lands on one-time —
  // this keeps the SUM exact (no off-by-one penny from independent floors).
  const recurringShare = Math.floor(
    (cappedDiscount * recurringSubtotal) / total,
  );
  const oneTimeShare = cappedDiscount - recurringShare;
  return {
    recurring: Math.min(recurringShare, recurringSubtotal),
    oneTime: Math.min(oneTimeShare, oneTimeSubtotal),
  };
}

/** Compute the full totals breakdown for a proposal + its lines. Pure. */
export function computeProposalTotalsCents(
  proposal: ProposalHeader,
  lines: ReadonlyArray<LineLike>,
): ProposalTotalsCents {
  const subtotals = computeSubtotalsCents(lines);
  const scopeRaw = proposal.discountScope ?? "both";
  const scope: DiscountScope = isDiscountScope(scopeRaw) ? scopeRaw : "both";
  const allocation = allocateDiscountCents({
    recurringSubtotal: subtotals.recurring,
    oneTimeSubtotal: subtotals.oneTime,
    discountAmount: proposal.discountAmountCents ?? 0,
    scope,
  });

  const recurringTotal = subtotals.recurring - allocation.recurring;
  const oneTimeTotal = subtotals.oneTime - allocation.oneTime;
  const hasTrial = (proposal.trialDays ?? 0) > 0;

  // First-invoice math:
  //  - With a trial, the recurring portion does NOT bill on day 0; only
  //    the one-time lines hit the first invoice (Stripe charges those
  //    immediately via add_invoice_items, even when the subscription is
  //    on a trial — this is a known Stripe behavior).
  //  - Without a trial, both buckets hit invoice #1.
  const firstInvoiceTotal = hasTrial
    ? oneTimeTotal
    : recurringTotal + oneTimeTotal;

  return {
    recurringSubtotal: subtotals.recurring,
    recurringDiscount: allocation.recurring,
    recurringTotal,
    oneTimeSubtotal: subtotals.oneTime,
    oneTimeDiscount: allocation.oneTime,
    oneTimeTotal,
    firstInvoiceTotal,
    hasTrial,
    trialDays: proposal.trialDays ?? 0,
    cadence: proposal.cadence ?? null,
  };
}

/** Convenience: take a fully-loaded ProposalWithLines and return totals. */
export function computeProposalTotalsFromRow(
  row: ProposalWithLines,
): ProposalTotalsCents {
  return computeProposalTotalsCents(row, row.lineItems);
}
