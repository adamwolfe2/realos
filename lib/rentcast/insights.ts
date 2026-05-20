// ---------------------------------------------------------------------------
// RentCast insights — pure interpretation helpers. Translate raw RentCast
// numbers into the interpreted, branded sentences the property detail page
// renders. Kept pure (no I/O, no Prisma) so the unit tests can exercise the
// boundaries without standing up a DB.
// ---------------------------------------------------------------------------

export type MarketTemperature = "HOT" | "WARM" | "COOL";

// Boundaries from the integration plan + live SG data:
//   * HOT  → median DOM ≤ 7 (Berkeley 94704 measured at 1 day in May)
//   * WARM → median DOM ≤ 21
//   * COOL → median DOM > 21
//
// `null` / missing data falls back to WARM as the safest interpretation.
export function marketTemperature(medianDOM: number | null | undefined): MarketTemperature {
  if (medianDOM === null || medianDOM === undefined || !Number.isFinite(medianDOM)) {
    return "WARM";
  }
  if (medianDOM <= 7) return "HOT";
  if (medianDOM <= 21) return "WARM";
  return "COOL";
}

export type RentGapDirection = "below" | "at" | "above";

export type RentGap = {
  delta: number;        // Whole-dollar difference: marketMid - currentRent
  deltaPct: number;     // Percentage difference vs. market mid (0–100)
  direction: RentGapDirection;
  copy: string;         // Interpreted sentence for the UI
};

// ---------------------------------------------------------------------------
// computeRentGap
//
// Inputs:
//   currentRentCents  → property's current asking rent in cents, or null if
//                       the operator hasn't set one yet. When null, returns
//                       a zero-delta "at market" placeholder so callers can
//                       hide the rent-gap bar.
//   marketMid         → RentCast's whole-dollar rent AVM midpoint.
//
// Output direction rules (matches the integration plan's copy):
//   * `at`    → within ±2% of market
//   * `below` → current rent is more than 2% under market → raise opportunity
//   * `above` → current rent is more than 2% over market → retention risk
//
// Copy strings are short, operator-facing sentences. The annualized "per
// unit" framing is intentional — feels premium and lets operators reason
// about portfolio-level lift without needing a calculator.
// ---------------------------------------------------------------------------
export function computeRentGap(
  currentRentCents: number | null | undefined,
  marketMid: number,
): RentGap {
  if (
    currentRentCents === null ||
    currentRentCents === undefined ||
    !Number.isFinite(currentRentCents) ||
    !Number.isFinite(marketMid) ||
    marketMid <= 0
  ) {
    return {
      delta: 0,
      deltaPct: 0,
      direction: "at",
      copy: "Add a current rent to see how this unit compares to market.",
    };
  }

  const currentRent = Math.round(currentRentCents / 100);
  const delta = marketMid - currentRent; // positive = below market, negative = above
  const deltaPct = (delta / marketMid) * 100;

  if (Math.abs(deltaPct) <= 2) {
    return {
      delta,
      deltaPct,
      direction: "at",
      copy: "Right at market — no action needed.",
    };
  }
  if (delta > 0) {
    const monthly = Math.round(delta);
    const annual = monthly * 12;
    return {
      delta,
      deltaPct,
      direction: "below",
      copy: `You're $${monthly.toLocaleString()}/mo below market. That's $${annual.toLocaleString()}/yr per unit.`,
    };
  }
  const over = Math.round(-delta);
  return {
    delta,
    deltaPct,
    direction: "above",
    copy: `$${over.toLocaleString()}/mo above market — retention risk.`,
  };
}

// ---------------------------------------------------------------------------
// normalizeAddress
//
// Used as part of the RentCast cache key. Collapses casing, whitespace, and
// punctuation noise so "2410 Telegraph Ave", "2410 telegraph ave," and
// "2410   TELEGRAPH AVE" all hash to the same snapshot row.
//
// Kept conservative — preserves digits, letters, and single hyphens so unit
// numbers like "201-A" stay distinct. Avoids any locale-aware case folding
// (toLocaleLowerCase) so the same call from a Vercel function in
// us-east-1 and a developer laptop produces identical strings.
// ---------------------------------------------------------------------------
export function normalizeAddress(addr: string): string {
  return addr
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/[^a-z0-9\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ /g, "-");
}

// ---------------------------------------------------------------------------
// Cache key helpers — single source of truth so the client, cache layer,
// and tests all agree on what "same request" means.
// ---------------------------------------------------------------------------
export function rentAvmCacheKey(input: {
  address: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  propertyType?: string | null;
}): string {
  const normalized = normalizeAddress(input.address);
  const bed = input.bedrooms != null ? `${input.bedrooms}br` : "-br";
  const bath = input.bathrooms != null ? `${input.bathrooms}ba` : "-ba";
  const type = (input.propertyType ?? "any").replace(/\s+/g, "");
  return `rent:${normalized}:${bed}:${bath}:${type}`;
}

export function valueAvmCacheKey(input: {
  address: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFootage?: number | null;
  propertyType?: string | null;
}): string {
  const normalized = normalizeAddress(input.address);
  const bed = input.bedrooms != null ? `${input.bedrooms}br` : "-br";
  const bath = input.bathrooms != null ? `${input.bathrooms}ba` : "-ba";
  const sqft = input.squareFootage != null ? `${input.squareFootage}sf` : "-sf";
  const type = (input.propertyType ?? "any").replace(/\s+/g, "");
  return `value:${normalized}:${bed}:${bath}:${sqft}:${type}`;
}

export function marketStatsCacheKey(input: {
  zipCode: string;
  historyRange?: number;
}): string {
  const zip = input.zipCode.trim().replace(/\s+/g, "");
  const range = input.historyRange ?? 6;
  return `market:${zip}:Rental:${range}`;
}

// ---------------------------------------------------------------------------
// Freshness helpers — used by the data-freshness chip on the hero card.
// ---------------------------------------------------------------------------
export function freshnessCopy(fetchedAt: Date): string {
  const diffMs = Date.now() - fetchedAt.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < hour) {
    const m = Math.max(1, Math.round(diffMs / minute));
    return `Updated ${m}m ago`;
  }
  if (diffMs < day) {
    const h = Math.round(diffMs / hour);
    return `Updated ${h}h ago`;
  }
  const d = Math.round(diffMs / day);
  return `Updated ${d}d ago`;
}
