// ---------------------------------------------------------------------------
// Pure totals math — client-safe.
//
// `lib/proposals/totals.ts` is `server-only` because it imports Prisma model
// types. The composer UI runs in the browser and needs the SAME math to
// render live totals as the operator edits lines. Rather than duplicate the
// arithmetic, we keep it pure here (no server-only, no Prisma types) and
// re-export from the server module via a thin wrapper.
//
// All inputs are integers in cents. Floats never enter the pipeline.
// ---------------------------------------------------------------------------

export type DiscountScopeShared = "recurring" | "one_time" | "both";

export function isDiscountScopeShared(value: string): value is DiscountScopeShared {
  return value === "recurring" || value === "one_time" || value === "both";
}

export type LineLikeShared = {
  unitPriceCents: number;
  quantity?: number | null;
  recurring?: boolean | null;
};

export type ProposalHeaderShared = {
  cadence: "MONTHLY" | "ANNUAL" | null;
  trialDays: number;
  discountAmountCents: number;
  discountScope: string;
};

export type ProposalTotalsShared = {
  recurringSubtotal: number;
  recurringDiscount: number;
  recurringTotal: number;
  oneTimeSubtotal: number;
  oneTimeDiscount: number;
  oneTimeTotal: number;
  firstInvoiceTotal: number;
  hasTrial: boolean;
  trialDays: number;
  cadence: "MONTHLY" | "ANNUAL" | null;
};

function safeQuantity(q: number | null | undefined): number {
  if (typeof q !== "number" || !Number.isFinite(q) || q <= 0) return 1;
  return Math.floor(q);
}

function safeRecurring(r: boolean | null | undefined): boolean {
  return r !== false;
}

export function computeSubtotalsCentsShared(
  lines: ReadonlyArray<LineLikeShared>,
): { recurring: number; oneTime: number } {
  let recurring = 0;
  let oneTime = 0;
  for (const line of lines) {
    const qty = safeQuantity(line.quantity);
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

export function allocateDiscountCentsShared(args: {
  recurringSubtotal: number;
  oneTimeSubtotal: number;
  discountAmount: number;
  scope: DiscountScopeShared;
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
  const total = recurringSubtotal + oneTimeSubtotal;
  if (total === 0) return { recurring: 0, oneTime: 0 };
  const cappedDiscount = Math.min(discount, total);
  const recurringShare = Math.floor(
    (cappedDiscount * recurringSubtotal) / total,
  );
  const oneTimeShare = cappedDiscount - recurringShare;
  return {
    recurring: Math.min(recurringShare, recurringSubtotal),
    oneTime: Math.min(oneTimeShare, oneTimeSubtotal),
  };
}

export function computeProposalTotalsShared(
  proposal: ProposalHeaderShared,
  lines: ReadonlyArray<LineLikeShared>,
): ProposalTotalsShared {
  const subtotals = computeSubtotalsCentsShared(lines);
  const scopeRaw = proposal.discountScope ?? "both";
  const scope: DiscountScopeShared = isDiscountScopeShared(scopeRaw)
    ? scopeRaw
    : "both";
  const allocation = allocateDiscountCentsShared({
    recurringSubtotal: subtotals.recurring,
    oneTimeSubtotal: subtotals.oneTime,
    discountAmount: proposal.discountAmountCents ?? 0,
    scope,
  });

  const recurringTotal = subtotals.recurring - allocation.recurring;
  const oneTimeTotal = subtotals.oneTime - allocation.oneTime;
  const hasTrial = (proposal.trialDays ?? 0) > 0;
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

/** Format integer cents → "$1,234.56" */
export function formatCents(cents: number): string {
  const dollars = Math.round(cents) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}
