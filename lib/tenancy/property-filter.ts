// ---------------------------------------------------------------------------
// Property filter helpers — used by every portal page that needs to slice
// a portfolio-wide query down to "just these properties."
//
// URL convention:
//   ?properties=id1,id2,id3   → multi-select (preferred)
//   ?property=<id>            → legacy single-pick (still honored for
//                                bookmarks / link-outs from older code)
//
// `null` return value means "no filter" (i.e. show all properties under
// the current tenant scope). Pages should treat null as "don't add a
// `propertyId` clause at all" — so the existing tenantWhere(scope) gate
// keeps doing its job.
// ---------------------------------------------------------------------------

export type PropertyFilterParams = {
  properties?: string | string[];
  property?: string | string[];
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
 * Build the Prisma `where` fragment for filtering by selected properties.
 * Pass the result into the page's existing `where` via spread:
 *
 *   const where = { ...tenantWhere(scope), ...propertyWhereFragment(ids) };
 *
 * Pass a `field` other than "propertyId" for relations that link via a
 * different column (e.g. nested filters).
 */
export function propertyWhereFragment(
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
