// ---------------------------------------------------------------------------
// Property filter helpers — used by every portal page that needs to slice
// a portfolio-wide query down to "just these properties."
//
// URL convention:
//   ?properties=id1,id2,id3   → multi-select (preferred)
//   ?property=<id>            → legacy single-pick (still honored for
//                                bookmarks / link-outs from older code)
//
// Two layers of filtering happen here:
//
//   1. USER SELECTION  — what the operator picked in the
//      PropertyMultiSelect. Captured by parsePropertyFilter().
//
//   2. ACCESS GATE     — what the operator is *allowed* to see, based on
//      UserPropertyAccess rows resolved into scope.allowedPropertyIds.
//      A non-null gate ALWAYS wins; selection is intersected with it.
//      A null gate means unrestricted (legacy / org-wide users).
//
// Pages combine both via propertyWhereFragment(scope, selectedIds). Never
// use a non-scope-aware property filter on tenant pages — it would let a
// restricted user widen their view by hand-editing the URL.
// ---------------------------------------------------------------------------

export type PropertyFilterParams = {
  properties?: string | string[];
  property?: string | string[];
};

type ScopeWithGate = {
  allowedPropertyIds: string[] | null;
};

/**
 * Parse a Next.js searchParams object into the list of selected property
 * IDs, or `null` if the user wants the full portfolio view.
 *
 * Returns `null` (not `[]`) for "no filter" so we never accidentally
 * generate `propertyId IN ()` — Prisma would treat that as "match nothing"
 * and silently blank every page.
 */
export function parsePropertyFilter(
  sp: PropertyFilterParams,
): string[] | null {
  const raw = firstString(sp.properties);
  if (raw) {
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return ids.length > 0 ? ids : null;
  }
  const single = firstString(sp.property);
  if (single) return [single];
  return null;
}

/**
 * Compute the effective property id list for the current request:
 * intersect the user's URL selection with their access gate (if any).
 *
 *   - Unrestricted scope + no selection  → null (no filter)
 *   - Unrestricted scope + selection     → selection
 *   - Restricted scope   + no selection  → the full allowed set
 *   - Restricted scope   + selection     → selection ∩ allowed (may be [])
 *
 * Returning `[]` from the intersection is meaningful: the user asked for
 * properties they don't have access to. Callers should treat this as
 * "see nothing."
 */
export function effectivePropertyIds(
  scope: ScopeWithGate,
  selectedIds: string[] | null,
): string[] | null {
  if (scope.allowedPropertyIds) {
    const allowed = new Set(scope.allowedPropertyIds);
    if (!selectedIds) return scope.allowedPropertyIds;
    return selectedIds.filter((id) => allowed.has(id));
  }
  return selectedIds;
}

/**
 * True when the URL is requesting properties the user can't see at all.
 * Pages should render an explanatory banner so a restricted user
 * doesn't sit in front of a blank page wondering why nothing loads.
 *
 * Returns false for unrestricted users — they always have access.
 */
export function isAccessDenied(
  scope: ScopeWithGate,
  selectedIds: string[] | null,
): boolean {
  if (!scope.allowedPropertyIds) return false;
  if (!selectedIds || selectedIds.length === 0) return false;
  const allowed = new Set(scope.allowedPropertyIds);
  // Only flag denial when EVERY requested property is out of bounds.
  // Mixed selections (some allowed, some not) silently drop the
  // unauthorized ids and show data for the rest.
  return selectedIds.every((id) => !allowed.has(id));
}

/**
 * Build the Prisma `where` fragment for filtering by selected properties,
 * with the access gate applied. Pass the result into the page's where via
 * spread:
 *
 *   const where = {
 *     ...tenantWhere(scope),
 *     ...propertyWhereFragment(scope, propertyIds),
 *   };
 *
 * Pass a `field` other than "propertyId" for relations that link via a
 * different column (e.g. nested filters on a related model).
 */
export function propertyWhereFragment(
  scope: ScopeWithGate,
  selectedIds: string[] | null,
  field: string = "propertyId",
): Record<string, unknown> {
  const ids = effectivePropertyIds(scope, selectedIds);

  // Restricted user asked for properties they don't have access to.
  // Return a synthetic id that matches no rows so the page renders
  // empty rather than silently widening to the full portfolio.
  if (scope.allowedPropertyIds && ids && ids.length === 0) {
    return { [field]: "__no_property_access__" };
  }
  if (!ids || ids.length === 0) return {};
  if (ids.length === 1) return { [field]: ids[0] };
  return { [field]: { in: ids } };
}

/**
 * Filter a list of properties down to the ones the current scope can see.
 * Used to populate the PropertyMultiSelect dropdown — restricted users
 * should not see properties they can't access in the first place.
 */
export function visibleProperties<T extends { id: string }>(
  scope: ScopeWithGate,
  all: T[],
): T[] {
  if (!scope.allowedPropertyIds) return all;
  const allowed = new Set(scope.allowedPropertyIds);
  return all.filter((p) => allowed.has(p.id));
}

/**
 * Internal helper: build a Prisma `where` fragment from a *pre-gated*
 * list of property ids. Used inside library code (e.g. attribution
 * queries) where the page has already applied the access gate via
 * effectivePropertyIds() and we just need to translate the resulting
 * id list into Prisma syntax.
 *
 * **Do not use this in page-level code.** Use propertyWhereFragment()
 * which takes scope and enforces the gate. This raw form bypasses the
 * gate by design.
 */
export function propertyIdsToWhere(
  ids: string[] | null,
  field: string = "propertyId",
): Record<string, unknown> {
  if (!ids || ids.length === 0) return {};
  if (ids.length === 1) return { [field]: ids[0] };
  return { [field]: { in: ids } };
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
