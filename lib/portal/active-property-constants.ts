// ---------------------------------------------------------------------------
// Shared constants for the active-property switcher.
//
// Lives in its own file (no "server-only" import) so client components
// like ActivePropertySwitcher can pull the sentinel without dragging in
// next/headers + the server gate from ./active-property.ts.
// ---------------------------------------------------------------------------

export const ACTIVE_PROPERTY_COOKIE = "portal_active_property_id";

// Sentinel value used by the switcher's "All properties" option. We
// store nothing in the cookie when the operator picks "All" so the
// default state is exactly the same as no cookie ever being set.
export const ALL_PROPERTIES_VALUE = "__all__";

// URL filter params that override the cookie in parsePropertyFilter.
export const PROPERTY_URL_PARAMS = ["properties", "property"] as const;

/**
 * The single property a URL filter pins (what the page is actually showing),
 * or null when the URL carries no filter or a multi-property one.
 */
export function urlPinnedPropertyId(sp: URLSearchParams): string | null {
  const multi = sp.get("properties");
  if (multi) {
    const ids = multi.split(",").map((s) => s.trim()).filter(Boolean);
    return ids.length === 1 ? ids[0] : null;
  }
  return sp.get("property") || null;
}

/**
 * Query string with the property URL filters removed. The sidebar switcher
 * writes the cookie, but a ?property= / ?properties= URL param wins over the
 * cookie, so without stripping them a switch on a deep-linked page did
 * nothing. Returns "" or "?a=b".
 */
export function withoutPropertyParams(sp: URLSearchParams): string {
  const next = new URLSearchParams(sp);
  for (const k of PROPERTY_URL_PARAMS) next.delete(k);
  const qs = next.toString();
  return qs ? `?${qs}` : "";
}
