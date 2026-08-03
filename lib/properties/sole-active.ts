import { prisma } from "@/lib/db";
import { marketablePropertyWhere } from "@/lib/properties/marketable";

/**
 * The "safe to stamp" rule, shared by the Cursive segment-sync ingest
 * path (lib/actions/admin-cursive.ts) and
 * scripts/backfill-visitor-propertyids.ts:
 *
 * When an org has EXACTLY ONE LAUNCHED property, visitors seen by that
 * org's pixel are filed under it — the org has exactly one site that
 * carries a pixel, so the visitor can only have been on that one.
 *
 * "Launched" is lifecycle=ACTIVE AND launchStatus=LIVE, and BOTH halves
 * are load-bearing:
 *   - lifecycle (via marketablePropertyWhere) drops EXCLUDED/ARCHIVED
 *     junk sub-records (parking, storage) and IMPORTED rows awaiting
 *     operator curation.
 *   - launchStatus is the field that actually tracks site/pixel/GA4/GSC
 *     connection (schema.prisma: ACTIVE rows default to ONBOARDING and
 *     get promoted to LIVE individually as each gets connected).
 *     Gating on lifecycle alone was wrong: real orgs (team, cleivas)
 *     have exactly one ACTIVE property that is still ONBOARDING — no
 *     site, no pixel — and would have had every visitor stamped onto a
 *     building they could not possibly have visited.
 *
 * Two or more launched properties → null; we never guess between real
 * candidates. Zero → null.
 *
 * Known ceiling, accepted (Adam decision, 2026-08-02 SG focus): this
 * trusts the launch fields, not a per-hostname domain binding — a pixel
 * pasted on an unrelated site would still stamp the sole launched
 * property. The webhook path's URL inference (cursive-process.ts) is
 * stricter; this rule deliberately supersedes it for sole-property orgs
 * on the URL-less paths (segment sync, historical backfill).
 */
export async function soleActiveProperty(
  orgId: string,
): Promise<{ id: string; name: string } | null> {
  const rows = await prisma.property.findMany({
    where: { ...marketablePropertyWhere(orgId), launchStatus: "LIVE" },
    select: { id: true, name: true },
    take: 2,
  });
  return rows.length === 1 ? rows[0] : null;
}
