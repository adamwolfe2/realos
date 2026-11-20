"use server";

import { revalidatePath } from "next/cache";
import { propertyInScope, requireScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { setActivePropertyId } from "@/lib/portal/active-property";
import { ALL_PROPERTIES_VALUE } from "@/lib/portal/active-property-constants";

// ---------------------------------------------------------------------------
// Server action backing the per-property switcher in the portal sidebar.
//
// Validates the chosen property id against the caller's scope so a
// hand-crafted POST can't widen visibility past the user's
// UserPropertyAccess grants. Persists the choice to the
// portal_active_property_id cookie via setActivePropertyId. Falls back
// to "All properties" silently if the user picks a property they
// shouldn't see (rather than throwing — keeps the UI responsive even
// in a stale-grant race).
// ---------------------------------------------------------------------------

export async function selectActiveProperty(
  rawValue: string | null,
): Promise<void> {
  const scope = await requireScope();

  // Treat null / empty / sentinel as "drop back to All properties." No
  // DB lookup needed; just clear the cookie.
  if (!rawValue || rawValue === ALL_PROPERTIES_VALUE) {
    await setActivePropertyId(null);
    revalidatePath("/portal", "layout");
    return;
  }

  // Validate the candidate id against the caller's access gate first, then
  // the marketable property set (org scope + lifecycle filter). The gate
  // used to be spread into the same object as `id: rawValue`, so for a
  // restricted user `id: { in: allowed }` overwrote the picked id and
  // findFirst returned an ARBITRARY allowed property: picking B could
  // silently scope every page to A.
  const candidate = propertyInScope(scope, rawValue)
    ? await prisma.property.findFirst({
        where: { ...marketablePropertyWhere(scope.orgId), id: rawValue },
        select: { id: true },
      })
    : null;

  // Fall back to "All" if the user picked something they can't see —
  // either the row was archived since the dropdown loaded, or an
  // outdated grant was revoked. We don't surface an error; the UI just
  // re-resolves to the default state on next render.
  if (!candidate) {
    await setActivePropertyId(null);
  } else {
    await setActivePropertyId(candidate.id);
  }

  revalidatePath("/portal", "layout");
}
