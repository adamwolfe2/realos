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
 * Resolution order:
 *   1. ?properties=a,b,c   → multi-select URL filter (preferred, shareable)
 *   2. ?property=<id>      → legacy single-pick URL filter
 *   3. ACTIVE_PROPERTY_COOKIE → operator's sidebar switcher selection
 *   4. null                → portfolio-wide (no filter)
 *
 * URL params ALWAYS win the cookie so shareable links and operator
 * deep-links from emails/Slack stay deterministic. Cookie is the
 * fallback when the URL is silent — that's the path the sidebar
 * switcher relies on to scope every page.
 *
 * Returns `null` (not `[]`) for "no filter" so we never accidentally
 * generate `propertyId IN ()` — Prisma would treat that as "match nothing"
 * and silently blank every page.
 *
 * NOTE: async because of the cookie read. Existing callers should add
 * `await`. Pages that genuinely want URL-only behavior (e.g. preview
 * tokens, public report links) should call parsePropertyFilterUrlOnly().
 */
export async function parsePropertyFilter(
  sp: PropertyFilterParams,
  /// Optional org scope. When provided, a cookie-sourced property id is
  /// validated against the org's marketable property set. A cookie
  /// holding an EXCLUDED / IMPORTED / ARCHIVED property (or one from a
  /// different org entirely) is treated as if no filter was set, AND
  /// the stale cookie is cleared so subsequent page loads don't repeat
  /// the lookup.
  ///
  /// Without the orgId param the function behaves exactly as before
  /// (no validation) — back-compat for the 20+ existing call sites that
  /// don't yet pass scope.
  orgId?: string,
): Promise<string[] | null> {
  const fromUrl = parsePropertyFilterUrlOnly(sp);
  if (fromUrl !== null) return fromUrl;
  // No URL filter — fall back to the active-property cookie written
  // by the sidebar switcher. Dynamic import keeps this file usable in
  // contexts without next/headers (tests, edge functions that don't
  // need the cookie path).
  const { getActivePropertyId, setActivePropertyId } =
    await import("@/lib/portal/active-property");
  const cookieId = await getActivePropertyId();
  if (!cookieId) return null;

  // Without orgId we can't validate — preserve legacy behavior.
  if (!orgId) return [cookieId];

  // Validate against the org's marketable set. A cookie holding a
  // non-marketable id is the smoking-gun cause of "dashboard is empty
  // even though the DB has data" (operator picks a property in the
  // switcher, that property is later auto-classified EXCLUDED by an
  // AppFolio re-sync, the cookie sticks, every KPI query silently
  // scopes to a property with zero rows). When we detect this, fall
  // through to portfolio view AND clear the stale cookie so a future
  // request doesn't repeat the bug.
  const { prisma } = await import("@/lib/db");
  const { marketablePropertyWhere } =
    await import("@/lib/properties/marketable");
  const exists = await prisma.property
    .findFirst({
      where: { ...marketablePropertyWhere(orgId), id: cookieId },
      select: { id: true },
    })
    .catch(() => null);
  if (exists) return [cookieId];

  // Best-effort cookie clear. Don't await indefinitely; if the
  // cookies() API is unavailable in the current context (rare), the
  // next page load will simply re-detect + re-clear.
  try {
    await setActivePropertyId(null);
  } catch {
    /* ignore — surfaces on next request */
  }
  return null;
}

/**
 * URL-only variant. Use when you explicitly DON'T want cookie fallback —
 * e.g. preview tokens, public report links, programmatic exports.
 */
export function parsePropertyFilterUrlOnly(
  sp: PropertyFilterParams,
): string[] | null {
  const raw = firstString(sp.properties);
  if (raw) {
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
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
 * Like propertyWhereFragment, but ALSO matches org-level rows where the
 * field is NULL. Use for models whose rows can be org-scoped rather than
 * property-tagged — notably Visitor: the Cursive pixel is installed
 * org-wide on the resident domain, so identified visitors carry
 * propertyId = null. Without this, selecting a property in the switcher
 * would hide EVERY pixel visitor (they'd never match propertyId = <id>).
 *
 * Org-level rows are already constrained to the org via the caller's
 * tenant where-clause, so widening to include them does not cross tenant
 * boundaries. The no-access sentinel is preserved so a restricted user
 * who selected a forbidden property still sees nothing.
 */
export function propertyOrOrgLevelWhereFragment(
  scope: ScopeWithGate,
  selectedIds: string[] | null,
  field: string = "propertyId",
): Record<string, unknown> {
  const base = propertyWhereFragment(scope, selectedIds, field);
  if (Object.keys(base).length === 0) return base; // no filter — nothing to widen
  if (base[field] === "__no_property_access__") return base; // preserve deny
  return { OR: [base, { [field]: null }] };
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
 * Like propertyWhereFragment, but when the user has NO explicit
 * selection (and no access gate), the query defaults to the org's
 * MARKETABLE (lifecycle=ACTIVE) property set instead of the entire
 * synced portfolio.
 *
 * Why: AppFolio syncs every property_directory row into Property —
 * including buildings the customer never enabled in LeaseStack. The
 * bare propertyWhereFragment returns `{}` for "no selection," which
 * silently widened every pipeline page (applications, renewals, work
 * orders, leads…) to the full synced portfolio. SG Real Estate saw 704
 * applications when only 72 belonged to Telegraph Commons, their one
 * enabled building.
 *
 * Semantics:
 *   - Explicit selection / restricted gate → identical to
 *     propertyWhereFragment (selection already comes from the
 *     marketable-only dropdown).
 *   - No selection, unrestricted → { field: { in: <marketable ids> } }.
 *   - Org has ZERO marketable properties → sentinel that matches no
 *     rows. Rendering nothing is honest; widening to disabled
 *     properties is not. (New orgs mid-curation see empty pipelines
 *     until they promote properties to ACTIVE — same rule the count
 *     tiles and sidebar already follow via marketablePropertyWhere.)
 */
export async function marketableScopedPropertyClause(
  scope: ScopeWithGate & { orgId: string },
  selectedIds: string[] | null,
  field: string = "propertyId",
  opts: {
    /// Explicit-selection path: when true, delegate to
    /// propertyOrOrgLevelWhereFragment (NULL-property rows stay visible
    /// alongside the picked properties — Visitor pages). When false
    /// (default), delegate to plain propertyWhereFragment — preserves
    /// each page's existing explicit-filter behavior exactly.
    selectedIncludesOrgRows?: boolean;
    /// Default (no-selection) path: when true, org-level NULL-property
    /// rows remain visible alongside the marketable set. Use for models
    /// with a nullable propertyId (Lead, Visitor, ChatbotConversation,
    /// AdCampaign, ClientReport) so unattributed rows don't vanish from
    /// the default view. Irrelevant for models where propertyId is
    /// required (Application, Tour, Resident, Lease, WorkOrder).
    defaultIncludesOrgRows?: boolean;
  } = {},
): Promise<Record<string, unknown>> {
  const base = opts.selectedIncludesOrgRows
    ? propertyOrOrgLevelWhereFragment(scope, selectedIds, field)
    : propertyWhereFragment(scope, selectedIds, field);
  if (Object.keys(base).length > 0) return base;

  const ids = await marketablePropertyIds(scope.orgId);
  if (ids.length === 0) return { [field]: "__no_marketable_properties__" };
  const inList = propertyIdsToWhere(ids, field);
  return opts.defaultIncludesOrgRows
    ? { OR: [inList, { [field]: null }] }
    : inList;
}

/**
 * The org's marketable (enabled) property id list. Dynamic imports keep
 * this file importable in contexts without the Prisma client (unit
 * tests exercise the pure helpers above without a DB).
 */
async function marketablePropertyIds(orgId: string): Promise<string[]> {
  const { prisma } = await import("@/lib/db");
  const { marketablePropertyWhere } = await import(
    "@/lib/properties/marketable"
  );
  const rows = await prisma.property.findMany({
    where: marketablePropertyWhere(orgId),
    select: { id: true },
  });
  return rows.map((r) => r.id);
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
