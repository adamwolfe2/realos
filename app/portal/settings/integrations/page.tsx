import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { PageHeader } from "@/components/admin/page-header";
import { StatusChip } from "@/components/portal/ui/status-chip";
import {
  TrustFooter,
  PrerequisiteLine,
  deriveSyncChip,
} from "@/components/portal/connect/trust-footer";
import { IntegrationMarketplace } from "@/components/portal/integrations/integration-marketplace";
import { PerPropertyIntegrationsPanel } from "@/components/portal/integrations/per-property-panel";
import { resolveIntegrationStatuses } from "@/lib/integrations/status";
import {
  ConnectAppfolioForm,
  DisconnectAppfolioForm,
  SyncAppfolioButton,
} from "./appfolio-forms";
import { ConnectFunnelForm } from "./funnel-forms";
import { AdPlatform } from "@prisma/client";
import {
  ConnectSeoForm,
  DisconnectSeoForm,
  SyncSeoButton,
} from "@/app/portal/seo/seo-connect-forms";
import {
  ConnectGoogleAdsForm,
  GoogleAdsManage,
} from "./google-ads-forms";
import {
  ConnectMetaAdsForm,
  MetaAdsManage,
} from "./meta-ads-forms";
import { OAuthConnectButton } from "./oauth-button";
import { isProviderConfigured } from "@/lib/integrations/oauth-config";
import { PENDING_OAUTH_BIND } from "@/lib/integrations/google-properties";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const scope = await requireScope();
  const [
    org,
    appfolio,
    funnel,
    seoIntegrations,
    adAccounts,
    oauthBoundAds,
    statuses,
    properties,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { name: true },
    }),
    prisma.appFolioIntegration.findUnique({
      where: { orgId: scope.orgId },
      select: {
        instanceSubdomain: true,
        clientIdEncrypted: true,
        useEmbedFallback: true,
        lastSyncAt: true,
        syncStatus: true,
        lastError: true,
      },
    }),
    prisma.funnelIntegration.findUnique({
      where: { orgId: scope.orgId },
      select: {
        apiKeyEncrypted: true,
        apiBaseUrl: true,
        groupId: true,
        discoverySourceId: true,
        enabled: true,
        lastPushAt: true,
        lastError: true,
      },
    }),
    prisma.seoIntegration.findMany({
      where: { orgId: scope.orgId },
      select: {
        provider: true,
        // After per-property migration, multiple rows can exist per
        // provider — one for each scoped property plus an optional
        // legacy org-wide row. propertyId distinguishes them.
        propertyId: true,
        property: { select: { id: true, name: true } },
        propertyIdentifier: true,
        serviceAccountEmail: true,
        lastSyncAt: true,
        lastSyncError: true,
        status: true,
      },
      orderBy: [{ provider: "asc" }, { propertyId: "asc" }],
    }),
    prisma.adAccount.findMany({
      where: { orgId: scope.orgId },
      select: {
        id: true,
        platform: true,
        externalAccountId: true,
        displayName: true,
        currency: true,
        accessStatus: true,
        credentialsEncrypted: true,
        lastSyncAt: true,
        lastSyncError: true,
      },
    }),
    // OAuth-bound ad accounts: rows in OAuthConnection that have a non-null
    // externalAccountId mean the operator completed the picker step. Used
    // to mark the matching AdAccount row as "connected" for the UI even
    // when its credentialsEncrypted is null (OAuth path leaves it null).
    prisma.oAuthConnection.findMany({
      where: {
        orgId: scope.orgId,
        provider: { in: ["google_ads", "meta_ads"] },
        status: "active",
        externalAccountId: { not: null },
      },
      select: { provider: true, externalAccountId: true },
    }),
    resolveIntegrationStatuses(scope.orgId),
    // Property list is threaded into the connect forms so multi-
    // property tenants can pick which LeaseStack property each new
    // GA4 / GSC connection scopes to. Empty list (single-
    // property org) means the connect forms render without a picker
    // and connections land on the legacy org-wide row. Scoped to
    // marketable properties (ACTIVE) so parking lots / storage /
    // pending-IMPORTED sub-records never show up in the property picker
    // or the per-property integrations matrix — same filter every
    // other property-selector surface uses.
    prisma.property.findMany({
      where: marketablePropertyWhere(scope.orgId),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!org) return null;

  const appfolioConnected =
    !!appfolio &&
    !!appfolio.instanceSubdomain &&
    (!!appfolio.clientIdEncrypted || !!appfolio.useEmbedFallback);

  // GA4 / Search Console: "Sign in with Google" first, then a property
  // picker (/portal/connect/{ga4,gsc}/select). The service-account paste
  // stays under Advanced for agencies that prefer it.
  function seoSlot(provider: "GSC" | "GA4"): React.ReactNode {
    const rows = seoIntegrations.filter((s) => s.provider === provider);
    const row = rows.find((r) => r.propertyId === null) ?? rows[0] ?? null;
    const label = provider === "GA4" ? "Google Analytics" : "Search Console";
    if (row && row.propertyIdentifier === PENDING_OAUTH_BIND) {
      return (
        <div className="rounded-[2px] border border-border bg-muted/30 p-4 space-y-2">
          <StatusChip status="connecting" label="Choose a property" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            You signed in with Google. Pick which {label} property to sync to
            finish connecting.
          </p>
          <Link
            href={`/portal/connect/${provider.toLowerCase()}/select`}
            className="inline-block text-xs font-medium text-primary hover:underline"
          >
            Choose property
          </Link>
        </div>
      );
    }
    if (row) {
      return (
        <SeoManage
          provider={provider}
          propertyIdentifier={row.propertyIdentifier}
          serviceAccountEmail={row.serviceAccountEmail}
          lastSyncAt={row.lastSyncAt}
          status={row.status}
          lastError={row.lastSyncError}
        />
      );
    }
    return (
      <div className="space-y-3">
        <PrerequisiteLine>
          You&apos;ll need: a Google login with access to your {label}{" "}
          property · ~1 min
        </PrerequisiteLine>
        <OAuthConnectButton
          provider={provider === "GA4" ? "google_ga4" : "google_gsc"}
        />
        <details className="group ls-card">
          <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground px-3 py-2 hover:text-foreground select-none">
            Advanced — use a service account instead
          </summary>
          <div className="px-3 pb-3 pt-1 border-t border-border">
            <ConnectSeoForm
              provider={provider}
              properties={properties.length > 1 ? properties : []}
            />
          </div>
        </details>
        <TrustFooter
          scopeNote={
            provider === "GA4"
              ? "Read-only: Google's analytics.readonly scope"
              : "Read-only: Google's webmasters.readonly scope"
          }
        />
      </div>
    );
  }

  const manageSlots: Record<string, React.ReactNode> = {
    appfolio: appfolioConnected ? (
      <AppfolioManage
        subdomain={appfolio!.instanceSubdomain ?? "—"}
        mode={appfolio!.clientIdEncrypted ? "REST API (Plus/Max)" : "Embed scrape (Core)"}
        lastSyncAt={appfolio!.lastSyncAt ?? null}
        syncStatus={appfolio!.syncStatus ?? null}
        lastError={appfolio!.lastError ?? null}
      />
    ) : (
      <ConnectAppfolioForm />
    ),
    funnel: (
      <ConnectFunnelForm
        connected={!!funnel}
        hasKey={!!funnel?.apiKeyEncrypted}
        apiBaseUrl={funnel?.apiBaseUrl ?? ""}
        groupId={funnel?.groupId != null ? String(funnel.groupId) : ""}
        discoverySourceId={funnel?.discoverySourceId ?? ""}
        enabled={!!funnel?.enabled}
        lastPushAt={funnel?.lastPushAt ? funnel.lastPushAt.toISOString() : null}
        lastError={funnel?.lastError ?? null}
      />
    ),
    gsc: seoSlot("GSC"),
    ga4: seoSlot("GA4"),
    "google-ads": (() => {
      const oauthBoundGoogleIds = new Set(
        oauthBoundAds
          .filter((b) => b.provider === "google_ads" && b.externalAccountId)
          .map((b) => b.externalAccountId!)
      );
      const connected = adAccounts.filter(
        (a) =>
          a.platform === AdPlatform.GOOGLE_ADS &&
          (!!a.credentialsEncrypted || oauthBoundGoogleIds.has(a.externalAccountId))
      );
      return (
        <div className="space-y-6">
          {connected.map((a) => (
            <GoogleAdsManage
              key={a.id}
              accountId={a.id}
              externalAccountId={a.externalAccountId}
              displayName={a.displayName}
              currency={a.currency}
              lastSyncAt={a.lastSyncAt}
              lastSyncError={a.lastSyncError}
              accessStatus={a.accessStatus}
            />
          ))}
          <div className={connected.length > 0 ? "pt-5 border-t border-border" : ""}>
            {connected.length > 0 ? (
              <h3 className="text-sm font-semibold mb-3">
                Connect another account
              </h3>
            ) : null}
            <div className="space-y-3">
              <PrerequisiteLine>
                You&apos;ll need: a Google login with access to your Google Ads
                account · ~2 min
              </PrerequisiteLine>
              <OAuthConnectButton provider="google_ads" />
              <details className="group ls-card">
                <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground px-3 py-2 hover:text-foreground select-none">
                  Advanced — paste credentials manually
                </summary>
                <div className="px-3 pb-3 pt-1 border-t border-border">
                  <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                    For agencies that prefer their own Google Cloud OAuth
                    client. Most operators should use the Connect button above
                    — it&apos;s the same data with no setup.
                  </p>
                  <ConnectGoogleAdsForm />
                </div>
              </details>
              {/* Honest scope note — the adwords scope is write-capable, so
                  no blanket "read-only" claim here (see connect-hub spec). */}
              <TrustFooter scopeNote="Uses Google's standard Ads API scope" />
            </div>
          </div>
        </div>
      );
    })(),
    "meta-ads": (() => {
      const oauthBoundMetaIds = new Set(
        oauthBoundAds
          .filter((b) => b.provider === "meta_ads" && b.externalAccountId)
          .map((b) => b.externalAccountId!)
      );
      const connected = adAccounts.filter(
        (a) =>
          a.platform === AdPlatform.META &&
          (!!a.credentialsEncrypted || oauthBoundMetaIds.has(a.externalAccountId))
      );
      return (
        <div className="space-y-6">
          {connected.map((a) => (
            <MetaAdsManage
              key={a.id}
              accountId={a.id}
              externalAccountId={a.externalAccountId}
              displayName={a.displayName}
              currency={a.currency}
              lastSyncAt={a.lastSyncAt}
              lastSyncError={a.lastSyncError}
              accessStatus={a.accessStatus}
            />
          ))}
          <div className={connected.length > 0 ? "pt-5 border-t border-border" : ""}>
            {connected.length > 0 ? (
              <h3 className="text-sm font-semibold mb-3">
                Connect another account
              </h3>
            ) : null}
            <div className="space-y-3">
              {isProviderConfigured("meta_ads") ? (
                <>
                  <PrerequisiteLine>
                    You&apos;ll need: a Facebook login with Business Manager
                    access to your ad account · ~2 min
                  </PrerequisiteLine>
                  <OAuthConnectButton provider="meta_ads" />
                  <details className="group ls-card">
                    <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground px-3 py-2 hover:text-foreground select-none">
                      Advanced — paste an access token instead
                    </summary>
                    <div className="px-3 pb-3 pt-1 border-t border-border">
                      <ConnectMetaAdsForm />
                    </div>
                  </details>
                </>
              ) : (
                <>
                  <PrerequisiteLine>
                    You&apos;ll need: admin access to the Meta Business
                    Manager that owns the ad account · ~5 min
                  </PrerequisiteLine>
                  <ConnectMetaAdsForm />
                </>
              )}
              <TrustFooter scopeNote="Read-only: Meta's ads_read permission" />
            </div>
          </div>
        </div>
      );
    })(),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/portal/settings"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Settings
          </Link>
        }
        title="Integrations"
        description="Connect the tools that feed your portal. New integrations unlock automatically as your account team activates them for you."
      />
      <IntegrationMarketplace statuses={statuses} manageSlots={manageSlots} />
      <PerPropertyIntegrationsPanel
        properties={properties}
        seoRows={seoIntegrations.map((s) => ({
          provider: s.provider,
          propertyId: s.propertyId,
          propertyIdentifier: s.propertyIdentifier,
        }))}
      />
    </div>
  );
}

// Cal.com tour-sync panel removed 2026-07-31 (Adam): every client books
// differently, so the per-org Cal webhook was dead weight. Tours still
// arrive via the public booking form + API-key ingest.

// ---------------------------------------------------------------------------
// AppFolio manage view — embedded inside the drawer for "appfolio" when the
// integration is already connected.
// ---------------------------------------------------------------------------

function AppfolioManage({
  subdomain,
  mode,
  lastSyncAt,
  syncStatus,
  lastError,
}: {
  subdomain: string;
  mode: string;
  lastSyncAt: Date | null;
  syncStatus: string | null;
  lastError: string | null;
}) {
  // Same status ladder as the Connect hub: error → first-sync-running →
  // live/stale (AppFolio's hourly cron makes 48h unambiguously stale).
  const chip = deriveSyncChip({ lastSyncAt, error: lastError, staleAfterHours: 48 });
  return (
    <div className="space-y-5">
      <StatusChip status={chip.status} label={chip.label} />
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <DetailRow label="Subdomain" value={subdomain} mono />
        <DetailRow label="Mode" value={mode} />
        <DetailRow
          label="Last sync"
          value={
            lastSyncAt
              ? formatDistanceToNow(lastSyncAt, { addSuffix: true })
              : "Never"
          }
        />
        <DetailRow
          label="Status"
          value={syncStatus ?? "Idle"}
          hint={lastError ?? undefined}
        />
      </dl>

      {lastError ? (
        <p className="text-[11px] text-destructive rounded-[2px] border border-destructive/30 bg-destructive/10 p-3">
          {lastError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SyncAppfolioButton />
        <DisconnectAppfolioForm />
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  hint,
  mono,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={`text-sm mt-0.5 break-all text-foreground ${
          mono ? "font-mono text-[12px]" : ""
        }`}
      >
        {value}
      </dd>
      {hint ? (
        <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SEO manage view — embedded inside the drawer for "gsc" or "ga4" when the
// integration is already connected. Both providers share the same shape so
// the same component handles both.
// ---------------------------------------------------------------------------

function SeoManage({
  provider,
  propertyIdentifier,
  serviceAccountEmail,
  lastSyncAt,
  status,
  lastError,
}: {
  provider: "GSC" | "GA4";
  propertyIdentifier: string;
  serviceAccountEmail: string | null;
  lastSyncAt: Date | null;
  status: string | null;
  lastError: string | null;
}) {
  // GA4/GSC report daily-ish — 72h before we call it stale (matches the
  // Connect hub's per-source thresholds).
  const chip = deriveSyncChip({ lastSyncAt, error: lastError, staleAfterHours: 72 });
  return (
    <div className="space-y-5">
      <StatusChip status={chip.status} label={chip.label} />
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <DetailRow label="Property" value={propertyIdentifier} mono />
        <DetailRow
          label="Service account"
          value={serviceAccountEmail ?? "—"}
          mono
        />
        <DetailRow
          label="Last sync"
          value={
            lastSyncAt
              ? formatDistanceToNow(lastSyncAt, { addSuffix: true })
              : "Never"
          }
        />
        <DetailRow label="Status" value={status ?? "Idle"} />
      </dl>

      {lastError ? (
        <p className="text-[11px] text-destructive rounded-[2px] border border-destructive/30 bg-destructive/10 p-3">
          {lastError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SyncSeoButton />
        <DisconnectSeoForm provider={provider} />
      </div>
    </div>
  );
}
