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
