import type { Metadata } from "next";
import { PixelRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { getConnectStatusForOrg } from "@/lib/connect/status";
import { ConnectHub } from "@/components/portal/connect/connect-hub";
import { getProviderAvailability } from "@/lib/connect/provider-availability";
import { getActivePropertyId } from "@/lib/portal/active-property";

export const metadata: Metadata = {
  title: "Connect your data · LeaseStack",
  description:
    "Plug in AppFolio, Google Analytics, Search Console, Google Ads, Meta Ads, and your website. Insights flow within minutes of your first connection.",
};
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/connect — the unified data-connection hub.
//
// Always reachable from the nav. Shows every data source as a card with
// connection status + a single CTA. Each newly-connected source kicks off
// background sync immediately and triggers the insight detectors as soon
// as data lands (see lib/insights/triggers.ts).
//
// Provider availability gates: when the agency hasn't completed OAuth setup
// (OAUTH_ENABLED + provider client IDs), the matching cards render a
// "coming soon" state instead of broken Connect buttons.
// ---------------------------------------------------------------------------

export default async function ConnectPage() {
  const scope = await requireScope();
  const activePropertyId = await getActivePropertyId().catch(() => null);
  const [sources, availability, activeProperty, pixelInFlight, pixelRequest] =
    await Promise.all([
      getConnectStatusForOrg(scope.orgId),
      Promise.resolve(getProviderAvailability()),
      activePropertyId
        ? prisma.property
            .findFirst({
              where: { id: activePropertyId, orgId: scope.orgId },
              select: { id: true, name: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
      // Cursive pixel "requested but not yet live" — server-persisted so a
      // refresh doesn't silently drop back to "Not connected". Two signals:
      // a cursiveIntegration row someone started (self-serve wizard minted a
      // webhookToken, or the request captured installedOnDomain) that has no
      // pixel bound yet…
      prisma.cursiveIntegration
        .findFirst({
          where: {
            orgId: scope.orgId,
            cursivePixelId: null,
            OR: [
              { webhookToken: { not: null } },
              { installedOnDomain: { not: null } },
            ],
          },
          select: { id: true },
        })
        .catch(() => null),
      // …or a legacy ops-fulfillment request still PENDING.
      prisma.pixelProvisionRequest
        .findFirst({
          where: { orgId: scope.orgId, status: PixelRequestStatus.PENDING },
          select: { id: true },
        })
        .catch(() => null),
    ]);

  const pixelRequested = Boolean(pixelInFlight || pixelRequest);

  return (
    <div className="max-w-[1100px] mx-auto px-4 lg:px-6 py-8 lg:py-12">
      <ConnectHub
        variant="page"
        availability={availability}
        activePropertyId={activeProperty?.id ?? null}
        activePropertyName={activeProperty?.name ?? null}
        sources={sources.map((s) => ({
          id: s.id,
          connected: s.connected,
          lastSyncAt: s.lastSyncAt ? s.lastSyncAt.toISOString() : null,
          accountLabel: s.accountLabel,
          healthNote: s.healthNote ?? null,
          provisioning:
            s.id === "cursive_pixel" && !s.connected ? pixelRequested : false,
        }))}
      />
    </div>
  );
}
