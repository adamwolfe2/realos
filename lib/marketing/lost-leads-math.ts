// ---------------------------------------------------------------------------
// Pure math for the /lost-leads calculator. No grounded "95% of visitors are
// anonymous" stat exists in PRODUCT.md (pixel copy only says "a meaningful
// share") — so this computes directly from what the prospect types in:
// monthly visitors minus monthly leads = renters who showed up and left
// unnamed. Clamped so bad input (leads > visitors, negatives) never prints
// a negative or NaN.
// ---------------------------------------------------------------------------

export interface LostLeadsResult {
  /** Renters who visited but never became a named lead, per month. */
  lostLeads: number;
  /** lostLeads as a share of visitors, 0–100. 0 when visitors is 0. */
  unnamedRate: number;
}

export function computeLostLeads(
  monthlyVisitors: number,
  monthlyLeads: number,
): LostLeadsResult {
  const visitors = Math.max(0, Math.floor(monthlyVisitors) || 0);
  const leads = Math.max(0, Math.floor(monthlyLeads) || 0);
  const lostLeads = Math.max(0, visitors - leads);
  const unnamedRate = visitors > 0 ? (lostLeads / visitors) * 100 : 0;
  return { lostLeads, unnamedRate };
}
