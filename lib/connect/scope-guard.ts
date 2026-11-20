import type { ScopedContext } from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// Property grant checks for integration connect / disconnect / bind actions.
//
// A property-restricted seat (allowedPropertyIds != null, e.g. an admin who
// only runs building A) may only touch connections scoped to a property in
// its grant. Org-wide connections (AppFolio, Funnel, ad accounts, a GA4/GSC
// row with propertyId=null) feed every property, so changing them would
// reach buildings outside the grant: restricted seats are refused, the same
// rule the vault applies to org-wide credentials and createProperty applies
// to new properties. Unrestricted seats are unaffected.
// ---------------------------------------------------------------------------

export const ORG_WIDE_INTEGRATION_DENIED =
  "This connection is shared by every property. Ask an owner or admin with access to all properties.";
export const PROPERTY_INTEGRATION_DENIED =
  "That property is outside your access.";

/** Error message when `scope` may not change a connection scoped to
    `propertyId` (null = org-wide), else null. */
export function integrationScopeError(
  scope: Pick<ScopedContext, "allowedPropertyIds">,
  propertyId: string | null,
): string | null {
  if (!scope.allowedPropertyIds) return null;
  if (propertyId === null) return ORG_WIDE_INTEGRATION_DENIED;
  return scope.allowedPropertyIds.includes(propertyId)
    ? null
    : PROPERTY_INTEGRATION_DENIED;
}
