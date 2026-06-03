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

/**
 * One phase on a Proposal.timeline. Weeks are RELATIVE to acceptance
 * (week 0 = signed-and-paid day) so the PDF doesn't bake calendar
 * dates that go stale before send.
 */
export type ProposalTimelinePhase = {
  /// Short phase name — "Kickoff", "Build", "Launch", "Optimize".
  phase: string;
  /// Inclusive start week, ≥ 0.
  startWeek: number;
  /// Inclusive end week, ≥ startWeek.
  endWeek: number;
  /// Concrete things the agency ships in this phase. Bullet list on the
  /// PDF; bullets get joined into a comma list on tight share views.
  deliverables: string[];
};

/**
 * Defensive normalizer: takes whatever JSON is stored on
 * `Proposal.timeline` (possibly null, possibly an old shape, possibly
 * an array of well-formed phases) and returns a clean phase array.
 * Drops malformed entries instead of throwing so a partial migration
 * never blocks a PDF render mid-flight.
 */
export function normalizeTimeline(raw: unknown): ProposalTimelinePhase[] {
  if (!Array.isArray(raw)) return [];
  const out: ProposalTimelinePhase[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Partial<ProposalTimelinePhase>;
    if (typeof p.phase !== "string" || p.phase.trim().length === 0) continue;
    const start = Number(p.startWeek);
    const end = Number(p.endWeek);
    if (!Number.isFinite(start) || start < 0) continue;
    if (!Number.isFinite(end) || end < start) continue;
    const deliverables = Array.isArray(p.deliverables)
      ? p.deliverables.filter(
          (d): d is string => typeof d === "string" && d.trim().length > 0,
        )
      : [];
    out.push({
      phase: p.phase.trim(),
      startWeek: Math.floor(start),
      endWeek: Math.floor(end),
      deliverables,
    });
  }
  return out;
}

/** Result of the customer lookup chain.
 *  `origin` records WHICH branch matched so audit logs can verify behavior.
 */
export type CustomerLookupResult = {
  stripeCustomerId: string;
  origin: "prospect_org" | "prior_proposal" | "stripe_search" | "created";
};
