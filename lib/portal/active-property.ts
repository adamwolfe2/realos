import "server-only";

// ---------------------------------------------------------------------------
// Active property scope (server side).
//
// Multi-property operators (managing 5 / 20 / 100 buildings on one
// account) couldn't scope individual pages before. This helper backs
// the per-property switcher in the portal sidebar:
//
//   - getActivePropertyId(cookies) reads the persisted selection
//   - setActivePropertyId(value)    writes / clears the cookie
//   - ACTIVE_PROPERTY_COOKIE        stable cookie key for both halves
//
// Pages that already accept a `?propertyId=` query param should fall
// back to the cookie when the URL doesn't carry one. "All properties"
// is the default — represented by clearing the cookie (null value).
//
// Adoption is incremental: pages that haven't migrated yet can ignore
// the cookie entirely and they keep rendering the org-wide view.
//
// IMPORTANT: shared constants (cookie name, sentinel) live in
// ./active-property-constants.ts so client components can import them
// without dragging in next/headers + "server-only".
// ---------------------------------------------------------------------------

import { cookies } from "next/headers";

export {
  ACTIVE_PROPERTY_COOKIE,
  ALL_PROPERTIES_VALUE,
} from "./active-property-constants";
import {
  ACTIVE_PROPERTY_COOKIE,
  ALL_PROPERTIES_VALUE,
} from "./active-property-constants";

// One year — long enough that the operator's choice persists across
// sessions, short enough that an inactive account eventually rolls back
// to the default.
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

/**
 * Resolve the active property id for the current request.
 *
 * Returns null when:
 *   - The cookie is unset
 *   - The cookie holds the ALL_PROPERTIES_VALUE sentinel
 *   - The cookie value is empty / not a string
 *
 * Returns the raw property id otherwise. Callers MUST still gate the
 * id through their own access check (`scope.allowedPropertyIds`) — this
 * helper only reads the user's preference, not their permissions.
 */
export async function getActivePropertyId(
  cookieStore?: CookieReader,
): Promise<string | null> {
  const store = cookieStore ?? (await cookies());
  const raw = store.get(ACTIVE_PROPERTY_COOKIE)?.value;
  if (!raw || raw === ALL_PROPERTIES_VALUE) return null;
  return raw;
}

/**
 * Write or clear the active-property cookie. Pass null (or the
 * ALL_PROPERTIES_VALUE sentinel) to drop back to the "All properties"
 * default. Called from the server action backing the switcher UI.
 */
export async function setActivePropertyId(
  value: string | null,
): Promise<void> {
  const store = await cookies();
  if (!value || value === ALL_PROPERTIES_VALUE) {
    store.delete(ACTIVE_PROPERTY_COOKIE);
    return;
  }
  store.set({
    name: ACTIVE_PROPERTY_COOKIE,
    value,
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
  });
}
