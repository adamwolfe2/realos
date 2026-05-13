import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Connect Hub status
//
// Single source of truth for "is this data source connected for this org?"
// Powers /portal/connect — the unified data-connection screen — and the
// onboarding wizard's connect step. Keep this list in sync with the cards
// rendered by components/portal/connect/connect-hub.tsx.
//
// Each source returns:
//   id          — stable slug used for OAuth route paths + analytics
//   connected   — true if at least one integration row exists
//   lastSyncAt  — when we last received fresh data, null if never
//   accountLabel — human label of the connected account (e.g. "GA4 property
//                  328111923") or null if not connected
// ---------------------------------------------------------------------------

export type ConnectSource =
  | "appfolio"
  | "ga4"
  | "gsc"
  | "google_ads"
  | "meta_ads"
  | "cursive_pixel"
  | "website";

export type ConnectSourceStatus = {
  id: ConnectSource;
  connected: boolean;
  lastSyncAt: Date | null;
  accountLabel: string | null;
  /** Property-level scope. null = org-wide (e.g. AppFolio); array = which
      properties have this source connected (e.g. Cursive pixel installed
      per-property). */
  scopedPropertyIds?: string[] | null;
};

export async function getConnectStatusForOrg(
  orgId: string,
): Promise<ConnectSourceStatus[]> {
  const [appfolio, seoIntegrations, adAccounts, cursive, website] =
    await Promise.all([
      prisma.appFolioIntegration
        .findFirst({
          where: { orgId },
          select: {
            subdomain: true,
            lastSyncAt: true,
          },
        })
        .catch(() => null),
      prisma.seoIntegration
        .findMany({
          where: { orgId },
          select: {
            provider: true,
            lastSyncAt: true,
            externalId: true,
            propertyId: true,
          },
        })
        .catch(() => [] as Array<{
          provider: string;
          lastSyncAt: Date | null;
          externalId: string | null;
          propertyId: string | null;
        }>),
      prisma.adAccount
        .findMany({
          where: { orgId },
          select: {
            platform: true,
            externalAccountId: true,
            lastSyncAt: true,
          },
        })
        .catch(() => [] as Array<{
          platform: string;
          externalAccountId: string;
          lastSyncAt: Date | null;
        }>),
      prisma.cursiveIntegration
        .findMany({
          where: { orgId },
          select: {
            cursivePixelId: true,
            lastEventAt: true,
            propertyId: true,
          },
        })
        .catch(() => [] as Array<{
          cursivePixelId: string | null;
          lastEventAt: Date | null;
          propertyId: string | null;
        }>),
      prisma.tenantSiteConfig
        .findFirst({
          where: { orgId },
          select: {
            customDomain: true,
            updatedAt: true,
          },
        })
        .catch(() => null),
    ]);

  const ga4 = seoIntegrations.find((s) => s.provider === "GA4");
  const gsc = seoIntegrations.find((s) => s.provider === "GSC");
  const googleAds = adAccounts.find((a) => a.platform === "GOOGLE_ADS");
  const metaAds = adAccounts.find((a) => a.platform === "META_ADS");
  const installedCursive = cursive.filter((c) => !!c.cursivePixelId);

  return [
    {
      id: "appfolio",
      connected: !!appfolio,
      lastSyncAt: appfolio?.lastSyncAt ?? null,
      accountLabel: appfolio?.subdomain
        ? `${appfolio.subdomain}.appfolio.com`
        : null,
    },
    {
      id: "ga4",
      connected: !!ga4,
      lastSyncAt: ga4?.lastSyncAt ?? null,
      accountLabel: ga4?.externalId
        ? `Property ${ga4.externalId}`
        : null,
    },
    {
      id: "gsc",
      connected: !!gsc,
      lastSyncAt: gsc?.lastSyncAt ?? null,
      accountLabel: gsc?.externalId ?? null,
    },
    {
      id: "google_ads",
      connected: !!googleAds,
      lastSyncAt: googleAds?.lastSyncAt ?? null,
      accountLabel: googleAds?.externalAccountId
        ? `Account ${googleAds.externalAccountId}`
        : null,
    },
    {
      id: "meta_ads",
      connected: !!metaAds,
      lastSyncAt: metaAds?.lastSyncAt ?? null,
      accountLabel: metaAds?.externalAccountId
        ? `Account ${metaAds.externalAccountId}`
        : null,
    },
    {
      id: "cursive_pixel",
      connected: installedCursive.length > 0,
      lastSyncAt:
        installedCursive
          .map((c) => c.lastEventAt?.getTime() ?? 0)
          .reduce((max, t) => (t > max ? t : max), 0) > 0
          ? new Date(
              installedCursive
                .map((c) => c.lastEventAt?.getTime() ?? 0)
                .reduce((max, t) => (t > max ? t : max), 0),
            )
          : null,
      accountLabel:
        installedCursive.length > 0
          ? `${installedCursive.length} pixel${installedCursive.length === 1 ? "" : "s"} installed`
          : null,
      scopedPropertyIds: installedCursive
        .map((c) => c.propertyId)
        .filter((id): id is string => !!id),
    },
    {
      id: "website",
      connected: !!website?.customDomain,
      lastSyncAt: website?.updatedAt ?? null,
      accountLabel: website?.customDomain ?? null,
    },
  ];
}

/** Quick boolean — used by the dashboard / nav to show a "Connect data" CTA
    when the org has fewer than N sources connected. */
export async function countConnectedSources(orgId: string): Promise<{
  connected: number;
  total: number;
}> {
  const sources = await getConnectStatusForOrg(orgId);
  return {
    connected: sources.filter((s) => s.connected).length,
    total: sources.length,
  };
}
