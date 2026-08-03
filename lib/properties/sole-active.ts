import { prisma } from "@/lib/db";
import { marketablePropertyWhere } from "@/lib/properties/marketable";

/**
 * The "safe to stamp" rule, shared by the Cursive segment-sync ingest
 * path (lib/actions/admin-cursive.ts) and
 * scripts/backfill-visitor-propertyids.ts:
 *
 * When an org has EXACTLY ONE ACTIVE property, visitors seen by that
 * org's pixel are filed under it. Justification (Adam decision,
 * 2026-08-02 SG focus spec): ACTIVE = launched — the only lifecycle
 * whose site carries the org's pixel. IMPORTED rows are by definition
 * unlaunched (no site, no pixel), and EXCLUDED/ARCHIVED are junk
 * sub-records, so they can't be the page a visitor was on. Two or more
 * ACTIVE properties → null; we never guess between real candidates.
 *
 * Known ceiling, accepted with the decision above: this trusts the
 * lifecycle field, not a domain binding — a pixel pasted on an
 * unrelated site would still stamp the sole ACTIVE property. The
 * webhook path's URL inference (cursive-process.ts) is stricter; this
 * rule deliberately supersedes it for sole-ACTIVE-property orgs on the
 * URL-less paths (segment sync, historical backfill).
 *
 * marketablePropertyWhere keeps the sole-ness count immune to junk
 * rows inflating it.
 */
export async function soleActiveProperty(
  orgId: string,
): Promise<{ id: string; name: string } | null> {
  const rows = await prisma.property.findMany({
    where: marketablePropertyWhere(orgId),
    select: { id: true, name: true },
    take: 2,
  });
  return rows.length === 1 ? rows[0] : null;
}
