/**
 * Resolves whether a given org currently has an active proposal add-on.
 *
 * "Active" = there exists at least one ACCEPTED proposal for this org
 * that (a) wasn't canceled or voided, and (b) has a line item linked
 * to a catalog entry with the requested slug.
 *
 * Cached for 60s in-process to keep per-page fan-out cheap; the cache
 * window is short enough that a newly-accepted add-on activates within
 * a minute, long enough that mass scope checks on a portal page don't
 * fan a query per render.
 *
 * Stripe subscription-status check is intentionally NOT layered on top
 * here — the proposal provision pipeline writes `canceledAt` on Stripe
 * cancellation, so the proposal row's lifecycle state is the source of
 * truth. A redundant Stripe poll is W3.1 follow-up.
 */

import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const ADDON_AEO_BOOST = "addon-aeo-boost";

export type ProposalAddonSlug = "addon-aeo-boost";

async function resolveOrgHasActiveAddon(
  orgId: string,
  addonSlug: string,
): Promise<boolean> {
  const count = await prisma.proposalLineItem.count({
    where: {
      catalogItem: { slug: addonSlug },
      proposal: {
        prospectOrgId: orgId,
        status: "ACCEPTED",
        canceledAt: null,
        voidedAt: null,
      },
    },
  });
  return count > 0;
}

/**
 * Cached lookup. Cache key includes both args so different (org, addon)
 * pairs don't collide; cache tag enables future cron-driven invalidation
 * (e.g. on proposal status change).
 */
export async function orgHasActiveAddon(
  orgId: string,
  addonSlug: ProposalAddonSlug,
): Promise<boolean> {
  const cached = unstable_cache(
    async () => resolveOrgHasActiveAddon(orgId, addonSlug),
    [`org-has-active-addon`, orgId, addonSlug],
    { revalidate: 60, tags: [`org-addons:${orgId}`] },
  );
  return cached();
}
