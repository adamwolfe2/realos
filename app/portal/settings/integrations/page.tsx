import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { IntegrationMarketplace } from "@/components/portal/integrations/integration-marketplace";
import { resolveIntegrationStatuses } from "@/lib/integrations/status";
import { CopySnippetButton } from "./copy-snippet";
import {
  ConnectPixelForm,
  DisconnectPixelForm,
} from "./integration-forms";
import { PixelSnippetPanel } from "./pixel-snippet-panel";
import {
  ConnectAppfolioForm,
  DisconnectAppfolioForm,
  SyncAppfolioButton,
} from "./appfolio-forms";
import { AdPlatform, SeoProvider } from "@prisma/client";
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

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const scope = await requireScope();
  const [org, pixel, appfolio, seoIntegrations, adAccounts, statuses] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { name: true, modulePixel: true, moduleChatbot: true },
    }),
    prisma.cursiveIntegration.findUnique({
      where: { orgId: scope.orgId },
      select: {
        cursivePixelId: true,
        pixelScriptUrl: true,
        installedOnDomain: true,
        provisionedAt: true,
        lastEventAt: true,
        totalEventsCount: true,
        publicSiteKey: true,
        publicKeyPrefix: true,
        publicKeyIssuedAt: true,
      },
    }),
    prisma.appFolioIntegration.findUnique({
      where: { orgId: scope.orgId },
      select: {
        instanceSubdomain: true,
        plan: true,
        clientIdEncrypted: true,
        clientSecretEncrypted: true,
        apiKeyEncrypted: true,
        lastSyncAt: true,
        syncStatus: true,
        lastError: true,
        autoSyncEnabled: true,
        syncFrequencyMinutes: true,
      },
    }),
    prisma.seoIntegration.findMany({
      where: { orgId: scope.orgId },
      select: {
        provider: true,
        propertyIdentifier: true,
        serviceAccountEmail: true,
        lastSyncAt: true,
        lastSyncError: true,
        status: true,
      },
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
    resolveIntegrationStatuses(scope.orgId),
  ]);

  if (!org) return null;

  const pixelProvisioned = Boolean(pixel?.cursivePixelId);
  const pixelInstallSnippet = pixel?.pixelScriptUrl
    ? `<script src="${pixel.pixelScriptUrl}" async></script>`
    : null;
  const pixelEligible = org.modulePixel || org.moduleChatbot;

  const appBaseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://realestaite.vercel.app"
  ).replace(/\/$/, "");

  const appfolioConnected =
    !!appfolio &&
    !!appfolio.instanceSubdomain &&
    (!!appfolio.clientIdEncrypted || !!appfolio.apiKeyEncrypted);

  const manageSlots: Record<string, React.ReactNode> = {
    "visitor-identification": pixelProvisioned ? (
      <PixelManage
        pixelId={pixel!.cursivePixelId!}
        installedOnDomain={pixel!.installedOnDomain ?? null}
        provisionedAt={pixel!.provisionedAt ?? null}
        lastEventAt={pixel!.lastEventAt ?? null}
        totalEventsCount={pixel!.totalEventsCount ?? 0}
        installSnippet={pixelInstallSnippet}
        publicSiteKey={pixel?.publicSiteKey ?? null}
        publicKeyPrefix={pixel?.publicKeyPrefix ?? null}
        publicKeyIssuedAt={pixel?.publicKeyIssuedAt ?? null}
        appBaseUrl={appBaseUrl}
      />
    ) : pixelEligible ? (
      <div className="space-y-6">
        <ConnectPixelForm defaultWebsiteName={org.name} />
        <div className="pt-5 border-t border-border space-y-3">
          <div>
            <h3 className="text-sm font-semibold">First-party pixel snippet</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Skip the AudienceLab handshake and start collecting visitor
              sessions immediately with our own lightweight pixel. Pageviews,
              scroll depth, time on page, UTM, and referrer flow into the
              visitor feed in real time.
            </p>
          </div>
          <PixelSnippetPanel
            initialPublicKey={pixel?.publicSiteKey ?? null}
            initialPrefix={pixel?.publicKeyPrefix ?? null}
            initialIssuedAt={
              pixel?.publicKeyIssuedAt
                ? pixel.publicKeyIssuedAt.toISOString()
                : null
            }
            appBaseUrl={appBaseUrl}
          />
        </div>
      </div>
    ) : (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/30 p-3">
          Your workspace doesn&apos;t have the visitor identification module
          enabled, so the AudienceLab integration is locked. You can still
          run the first-party pixel below to capture pageviews and sessions
          right away.
        </p>
        <PixelSnippetPanel
          initialPublicKey={pixel?.publicSiteKey ?? null}
          initialPrefix={pixel?.publicKeyPrefix ?? null}
          initialIssuedAt={
            pixel?.publicKeyIssuedAt
              ? pixel.publicKeyIssuedAt.toISOString()
              : null
          }
          appBaseUrl={appBaseUrl}
        />
      </div>
    ),
    appfolio: appfolioConnected ? (
      <AppfolioManage
        subdomain={appfolio!.instanceSubdomain ?? "—"}
        plan={appfolio!.plan ?? null}
        lastSyncAt={appfolio!.lastSyncAt ?? null}
        syncStatus={appfolio!.syncStatus ?? null}
        lastError={appfolio!.lastError ?? null}
      />
    ) : (
      <ConnectAppfolioForm />
    ),
    gsc: (() => {
      const row = seoIntegrations.find((s) => s.provider === SeoProvider.GSC);
      return row ? (
        <SeoManage
          provider="GSC"
          propertyIdentifier={row.propertyIdentifier}
          serviceAccountEmail={row.serviceAccountEmail}
          lastSyncAt={row.lastSyncAt}
          status={row.status}
          lastError={row.lastSyncError}
        />
      ) : (
        <ConnectSeoForm provider="GSC" />
      );
    })(),
    ga4: (() => {
      const row = seoIntegrations.find((s) => s.provider === SeoProvider.GA4);
      return row ? (
        <SeoManage
          provider="GA4"
          propertyIdentifier={row.propertyIdentifier}
          serviceAccountEmail={row.serviceAccountEmail}
          lastSyncAt={row.lastSyncAt}
          status={row.status}
          lastError={row.lastSyncError}
        />
      ) : (
        <ConnectSeoForm provider="GA4" />
      );
    })(),
    "google-ads": (() => {
      const connected = adAccounts.filter(
        (a) =>
          a.platform === AdPlatform.GOOGLE_ADS && !!a.credentialsEncrypted
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
            <ConnectGoogleAdsForm />
          </div>
        </div>
      );
    })(),
    "meta-ads": (() => {
      const connected = adAccounts.filter(
        (a) => a.platform === AdPlatform.META && !!a.credentialsEncrypted
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
            <ConnectMetaAdsForm />
          </div>
        </div>
      );
    })(),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect the tools that feed your portal. New integrations unlock automatically as your account team activates them for you."
      />
      <IntegrationMarketplace statuses={statuses} manageSlots={manageSlots} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pixel manage view — embedded inside the drawer for "visitor-identification"
// when the integration is already provisioned.
// ---------------------------------------------------------------------------

function PixelManage({
  pixelId,
  installedOnDomain,
  provisionedAt,
  lastEventAt,
  totalEventsCount,
  installSnippet,
  publicSiteKey,
  publicKeyPrefix,
  publicKeyIssuedAt,
  appBaseUrl,
}: {
  pixelId: string;
  installedOnDomain: string | null;
  provisionedAt: Date | null;
  lastEventAt: Date | null;
  totalEventsCount: number;
  installSnippet: string | null;
  publicSiteKey: string | null;
  publicKeyPrefix: string | null;
  publicKeyIssuedAt: Date | null;
  appBaseUrl: string;
}) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <DetailRow label="Pixel ID" value={pixelId} mono />
        <DetailRow
          label="Installed on"
          value={installedOnDomain ?? "—"}
          mono
        />
        <DetailRow
          label="Provisioned"
          value={
            provisionedAt
              ? formatDistanceToNow(provisionedAt, { addSuffix: true })
              : "—"
          }
        />
        <DetailRow
          label="Last event"
          value={
            lastEventAt
              ? formatDistanceToNow(lastEventAt, { addSuffix: true })
              : "No events yet"
          }
          hint={
            totalEventsCount > 0
              ? `${totalEventsCount.toLocaleString()} total events`
              : undefined
          }
        />
      </dl>

      {installSnippet ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium text-foreground">
              AudienceLab install snippet
            </span>
            <CopySnippetButton snippet={installSnippet} />
          </div>
          <pre
            className="rounded-md border border-border bg-muted/50 p-3 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all text-foreground"
            style={{ borderRadius: 6 }}
          >
            {installSnippet}
          </pre>
          <p className="text-[11px] text-muted-foreground">
            Paste this tag into the {"<head>"} of every page on your site
            where you want visitor identification to run.
          </p>
        </div>
      ) : null}

      <div className="pt-5 border-t border-border space-y-3">
        <div>
          <h3 className="text-sm font-semibold">First-party pixel snippet</h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            Lightweight, dependency-free pixel for pageviews, scroll depth,
            time on page, UTM, and referrer. Runs alongside AudienceLab and
            feeds the same visitor feed.
          </p>
        </div>
        <PixelSnippetPanel
          initialPublicKey={publicSiteKey}
          initialPrefix={publicKeyPrefix}
          initialIssuedAt={
            publicKeyIssuedAt ? publicKeyIssuedAt.toISOString() : null
          }
          appBaseUrl={appBaseUrl}
        />
      </div>

      <DisconnectPixelForm />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppFolio manage view — embedded inside the drawer for "appfolio" when the
// integration is already connected.
// ---------------------------------------------------------------------------

function AppfolioManage({
  subdomain,
  plan,
  lastSyncAt,
  syncStatus,
  lastError,
}: {
  subdomain: string;
  plan: string | null;
  lastSyncAt: Date | null;
  syncStatus: string | null;
  lastError: string | null;
}) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <DetailRow label="Subdomain" value={subdomain} mono />
        <DetailRow
          label="Plan"
          value={plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "—"}
        />
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
        <p className="text-[11px] text-rose-700 rounded-md border border-rose-200 bg-rose-50 p-3">
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
  return (
    <div className="space-y-5">
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
        <p className="text-[11px] text-rose-700 rounded-md border border-rose-200 bg-rose-50 p-3">
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
