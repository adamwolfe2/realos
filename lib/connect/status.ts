import "server-only";
import { prisma } from "@/lib/db";
import { classifyHealth } from "@/lib/integrations/status";

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
  /** Source-specific health note (e.g. AppFolio "Auto-sync paused"). When
      present, the Connect hub card renders a subtle amber chip linking to
      the per-integration settings page rather than implying the source is
      fully green. */
  healthNote?: { label: string; href: string } | null;
  /** True when the most recent sync errored (bad creds, quota, API
      failure). Computed with the exact same RED-classification logic as
      the Integrations status page (lib/integrations/status.ts) so the
      Connect hub chip and the Integrations marketplace pill can never
      disagree about whether a source is broken. */
  hasError?: boolean;
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
            instanceSubdomain: true,
            lastSyncAt: true,
            autoSyncEnabled: true,
            // Sync-error signal — same fields the Integrations status page
            // reads (lib/integrations/status.ts resolveOne) so this hub's
            // chip can flip to "error" instead of staying stuck on
            // stale/live when every recent AppFolio cron tick failed.
            syncStatus: true,
            lastError: true,
          },
        })
        .catch(() => null),
      prisma.seoIntegration
        .findMany({
          where: { orgId },
          select: {
            provider: true,
            lastSyncAt: true,
            propertyIdentifier: true,
            propertyId: true,
            // Same error signal the Integrations status page ORs across
            // every per-property row (lib/integrations/status.ts
            // seoBySlug) — read here for the identical honest RED check.
            status: true,
            lastSyncError: true,
          },
        })
        .catch(() => [] as Array<{
          provider: string;
          lastSyncAt: Date | null;
          propertyIdentifier: string | null;
          propertyId: string | null;
          status: string | null;
          lastSyncError: string | null;
        }>),
      prisma.adAccount
        .findMany({
          where: { orgId },
          select: {
            platform: true,
            externalAccountId: true,
            lastSyncAt: true,
            lastSyncError: true,
          },
        })
        .catch(() => [] as Array<{
          platform: string;
          externalAccountId: string;
          lastSyncAt: Date | null;
          lastSyncError: string | null;
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
      // Website connection = at least one DomainBinding row (custom
       // hostname attached via Vercel Domain API). The TenantSiteConfig
       // exists for every org by default, so its presence isn't a
       // useful "connected" signal — what matters is whether the
       // operator has bound a real custom domain.
      prisma.domainBinding
        .findFirst({
          where: { orgId },
          select: {
            hostname: true,
            updatedAt: true,
            isPrimary: true,
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        })
        .catch(() => null),
    ]);

  const ga4 = seoIntegrations.find((s) => s.provider === "GA4");
  const gsc = seoIntegrations.find((s) => s.provider === "GSC");
  const googleAds = adAccounts.find((a) => a.platform === "GOOGLE_ADS");
  const metaAds = adAccounts.find((a) => a.platform === "META_ADS");
  const installedCursive = cursive.filter((c) => !!c.cursivePixelId);

  // Error aggregation — a multi-property tenant can have several GA4/GSC
  // rows (one per property) or several ad accounts per platform. ANY row
  // erroring must flip the source to "error", same OR-across-rows rule
  // lib/integrations/status.ts uses (seoBySlug/adsBySlug) — picking only
  // the first row here would hide a broken second property/account.
  const ga4HasError = seoIntegrations
    .filter((s) => s.provider === "GA4")
    .some((s) => s.status === "ERROR" || !!s.lastSyncError);
  const gscHasError = seoIntegrations
    .filter((s) => s.provider === "GSC")
    .some((s) => s.status === "ERROR" || !!s.lastSyncError);
  const googleAdsHasError = adAccounts
    .filter((a) => a.platform === "GOOGLE_ADS")
    .some((a) => !!a.lastSyncError);
  const metaAdsHasError = adAccounts
    .filter((a) => a.platform === "META_ADS")
    .some((a) => !!a.lastSyncError);
  const appfolioHasError =
    !!appfolio && (appfolio.syncStatus === "error" || !!appfolio.lastError);

  return [
    {
      id: "appfolio",
      connected: !!appfolio,
      lastSyncAt: appfolio?.lastSyncAt ?? null,
      accountLabel: appfolio?.instanceSubdomain
        ? `${appfolio.instanceSubdomain}.appfolio.com`
        : null,
      // Surface "Auto-sync paused" so the Connect hub renders an honest
      // amber state when the operator has switched the hourly cron off
      // (default-true field on AppFolioIntegration). Clicking the chip
      // jumps to the per-integration settings panel where the toggle lives.
      healthNote:
        appfolio && appfolio.autoSyncEnabled === false
          ? {
              label: "Auto-sync paused — enable for fresh data every hour",
              href: "/portal/settings/integrations#appfolio",
            }
          : null,
      hasError: appfolioHasError,
    },
    {
      id: "ga4",
      connected: !!ga4,
      lastSyncAt: ga4?.lastSyncAt ?? null,
      accountLabel: ga4?.propertyIdentifier
        ? `Property ${ga4.propertyIdentifier}`
        : null,
      // classifyHealth is the exact function the Integrations status page
      // uses for GA4/GSC (lib/integrations/status.ts) — reused here rather
      // than a hand-rolled RED check so the two surfaces are structurally
      // incapable of disagreeing on whether GA4 is erroring.
      hasError: classifyHealth("ga4", ga4?.lastSyncAt ?? null, ga4HasError) === "error",
    },
    {
      id: "gsc",
      connected: !!gsc,
      lastSyncAt: gsc?.lastSyncAt ?? null,
      accountLabel: gsc?.propertyIdentifier ?? null,
      hasError: classifyHealth("gsc", gsc?.lastSyncAt ?? null, gscHasError) === "error",
    },
    {
      id: "google_ads",
      connected: !!googleAds,
      lastSyncAt: googleAds?.lastSyncAt ?? null,
      accountLabel: googleAds?.externalAccountId
        ? `Account ${googleAds.externalAccountId}`
        : null,
      hasError: googleAdsHasError,
    },
    {
      id: "meta_ads",
      connected: !!metaAds,
      lastSyncAt: metaAds?.lastSyncAt ?? null,
      accountLabel: metaAds?.externalAccountId
        ? `Account ${metaAds.externalAccountId}`
        : null,
      hasError: metaAdsHasError,
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
      connected: !!website?.hostname,
      lastSyncAt: website?.updatedAt ?? null,
      accountLabel: website?.hostname ?? null,
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
