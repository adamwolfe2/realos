import "server-only";

// ---------------------------------------------------------------------------
// Auto-derive starter target queries for a property.
//
// When the SEO Agent first scans a property, we don't yet have the
// operator's list of "queries I want to rank for." Instead of leaving
// the property unscanned, we generate a starter set from what we
// already know: property name, city, subtype (student housing /
// multifamily / etc.), neighborhood pages already published.
//
// The operator can edit / extend the list via /portal/seo/agent.
// Auto-derived rows are flagged `addedBy: null` so the operator UI
// can show "Suggested by LeaseStack" badges and easy "promote / remove"
// affordances.
//
// We cap auto-derivation at 4 queries per property so the daily SERP
// scan stays under the cost guard (~$0.05/property/day).
// ---------------------------------------------------------------------------

import type { Property } from "@prisma/client";

const MAX_AUTO_QUERIES = 4;

type PropertyForDerivation = Pick<
  Property,
  | "name"
  | "city"
  | "state"
  | "addressLine1"
  | "residentialSubtype"
  | "commercialSubtype"
  | "propertyType"
>;

type DerivedQuery = {
  query: string;
  intent: "branded" | "local" | "transactional" | "informational";
};

function subtypeLabel(p: PropertyForDerivation): string | null {
  if (p.residentialSubtype === "STUDENT_HOUSING") return "student housing";
  if (p.residentialSubtype === "MULTIFAMILY") return "apartments";
  if (p.residentialSubtype === "SENIOR_LIVING") return "senior living";
  if (p.residentialSubtype === "SINGLE_FAMILY_RENTAL") return "rental homes";
  if (p.residentialSubtype === "CO_LIVING") return "co-living";
  if (p.residentialSubtype === "SHORT_TERM_RENTAL") return "short-term rentals";
  if (p.commercialSubtype === "OFFICE") return "office space";
  if (p.commercialSubtype === "RETAIL") return "retail space";
  if (p.commercialSubtype === "INDUSTRIAL") return "industrial space";
  if (p.commercialSubtype === "MIXED_USE") return "mixed-use space";
  if (p.commercialSubtype === "FLEX_SPACE") return "flex space";
  if (p.commercialSubtype === "MEDICAL_OFFICE") return "medical office space";
  // Fallback to bare propertyType.
  if (p.propertyType === "RESIDENTIAL") return "apartments";
  if (p.propertyType === "COMMERCIAL") return "commercial space";
  return null;
}

/**
 * Generate 2-4 starter SEO queries for a property from its facts.
 * Returns plain strings + intent tags. The caller persists via
 * SeoTargetQuery upsert.
 */
export function deriveStarterQueries(
  property: PropertyForDerivation,
): DerivedQuery[] {
  const queries: DerivedQuery[] = [];
  const subtype = subtypeLabel(property);
  const cityLabel = property.city?.trim() ?? null;

  // 1. Branded query — operators rank #1 on their own name within days.
  // Worth tracking to catch outages or reputation crises.
  if (property.name && property.name.length > 0) {
    queries.push({ query: property.name, intent: "branded" });
  }

  // 2. "<subtype> in <city>" — the canonical local query.
  if (subtype && cityLabel) {
    queries.push({
      query: `${subtype} in ${cityLabel}`,
      intent: "local",
    });
  }

  // 3. "<subtype> near <city>" — captures prospects searching by
  // neighborhood references. Different SERP shape than "in".
  if (subtype && cityLabel) {
    queries.push({
      query: `${subtype} near ${cityLabel}`,
      intent: "local",
    });
  }

  // 4. Transactional — student housing operators in particular get a
  // huge lift from "apartments for rent <city>" type queries.
  if (cityLabel) {
    // Pick the verb form based on subtype semantics.
    const transactional =
      property.residentialSubtype === "STUDENT_HOUSING"
        ? `student housing for rent ${cityLabel}`
        : property.propertyType === "RESIDENTIAL"
          ? `apartments for rent ${cityLabel}`
          : property.propertyType === "COMMERCIAL"
            ? `${subtype ?? "commercial space"} for lease ${cityLabel}`
            : null;
    if (transactional) {
      queries.push({ query: transactional, intent: "transactional" });
    }
  }

  // 5. (Bonus, only used if previous gates didn't fill the slate)
  // "near me" style. Falls back to subtype + city.
  if (queries.length < MAX_AUTO_QUERIES && subtype && cityLabel) {
    queries.push({
      query: `best ${subtype} ${cityLabel}`,
      intent: "informational",
    });
  }

  // Dedupe (e.g. branded == city collision in some edge cases) and cap.
  const seen = new Set<string>();
  const unique = queries.filter((q) => {
    const k = q.query.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.slice(0, MAX_AUTO_QUERIES);
}
