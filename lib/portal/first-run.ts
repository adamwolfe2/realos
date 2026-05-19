import "server-only";
import { prisma } from "@/lib/db";
import { countConnectedSources } from "@/lib/connect/status";

// ---------------------------------------------------------------------------
// First-run detection
//
// Decides whether a freshly signed-up org sees the empty Marketplace landing
// page (in place of the operator dashboard) or the regular dashboard. A new
// org has nothing meaningful to render — every KPI tile shows zero, the
// activity feed is empty, every chart is a flat line. Shipping them
// straight to that screen is a "is this product even working?" moment.
//
// Heuristic — TRUE if ALL three signals are zero:
//   1. No "user-activated" modules are on.
//        We count toggleable + addon module<X> Boolean flags. We DO NOT
//        count the two columns that default to true at org creation
//        (moduleWebsite, moduleLeadCapture) — counting them would short
//        circuit the heuristic for every new account.
//   2. Zero Lead rows for the org.
//        Any lead — manual entry, ingest API, pixel — means the operator
//        is past the empty-room stage and should see the dashboard.
//   3. Zero connected data sources.
//        AppFolio, GA4, GSC, Google Ads, Meta Ads, Cursive pixel, or a
//        bound custom domain. As soon as ANY one is connected the org is
//        live enough that the dashboard has at least one populated tile.
//
// If any one of those signals is non-zero the org gets the normal
// dashboard. This means the first-run experience disappears the moment
// the operator does anything real — adds a lead, connects GA4, activates
// the pixel — without us tracking a separate "onboarded" Boolean that
// can drift out of sync with reality.
//
// Agency impersonation: requireScope() returns the IMPERSONATED orgId in
// scope.orgId, so calling this helper with that orgId gives an agency user
// supporting a brand-new client exactly the same first-run experience the
// client would see directly. No special-case needed.
// ---------------------------------------------------------------------------

export type FirstRunSignal = {
  isFirstRun: boolean;
  // Surfaced for debugging / future tweaks — not currently rendered.
  activatedModuleCount: number;
  leadCount: number;
  connectedSourceCount: number;
};

export async function getFirstRunSignal(orgId: string): Promise<FirstRunSignal> {
  const [org, leadCount, sourceStatus] = await Promise.all([
    prisma.organization
      .findUnique({
        where: { id: orgId },
        select: {
          modulePixel: true,
          moduleChatbot: true,
          moduleGoogleAds: true,
          moduleMetaAds: true,
          moduleSEO: true,
          moduleEmail: true,
          moduleOutboundEmail: true,
          moduleReferrals: true,
          moduleCreativeStudio: true,
          modulePopups: true,
          // moduleWebsite + moduleLeadCapture intentionally omitted —
          // both default to true at org creation and would defeat the
          // "no modules on" signal.
        },
      })
      .catch(() => null),
    prisma.lead.count({ where: { orgId } }).catch(() => 0),
    countConnectedSources(orgId).catch(() => ({ connected: 0, total: 0 })),
  ]);

  // Count non-default modules currently enabled.
  const activatedModuleCount = org
    ? Object.values(org).filter((v) => v === true).length
    : 0;

  const connectedSourceCount = sourceStatus.connected;

  const isFirstRun =
    activatedModuleCount === 0 &&
    leadCount === 0 &&
    connectedSourceCount === 0;

  return {
    isFirstRun,
    activatedModuleCount,
    leadCount,
    connectedSourceCount,
  };
}
