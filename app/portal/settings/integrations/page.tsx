import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { IntegrationMarketplace } from "@/components/portal/integrations/integration-marketplace";
import { PerPropertyIntegrationsPanel } from "@/components/portal/integrations/per-property-panel";
import { resolveIntegrationStatuses } from "@/lib/integrations/status";
import { CopySnippetButton } from "./copy-snippet";
import { DisconnectPixelForm } from "./integration-forms";
import { CursiveWebhookBadge } from "@/components/portal/integrations/cursive-webhook-badge";
import { CursiveSetupWizard } from "@/components/portal/integrations/cursive-setup-wizard";
import { PixelRequestStatus } from "@prisma/client";
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
import { OAuthConnectButton } from "./oauth-button";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const scope = await requireScope();
  const [
    org,
    pixel,
    appfolio,
    seoIntegrations,
    adAccounts,
    oauthBoundAds,
    statuses,
    properties,
    pendingPixelRequest,
    allCursiveRows,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { name: true, modulePixel: true, moduleChatbot: true },
    }),
    // Per-property migration: pull the legacy org-wide row (propertyId =
    // NULL). Settings / Integrations panel still renders this as "the
    // pixel for this workspace" — per-property pixel overrides are
    // managed elsewhere.
    prisma.cursiveIntegration.findFirst({
      where: { orgId: scope.orgId, propertyId: null },
      select: {
        cursivePixelId: true,
        pixelScriptUrl: true,
        installedOnDomain: true,
        provisionedAt: true,
        lastEventAt: true,
        totalEventsCount: true,
        lastPixelHitAt: true,
        totalPixelHitsCount: true,
        webhookToken: true,
      },
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
    // GA4 / GSC / Pixel connection scopes to. Empty list (single-
    // property org) means the connect forms render without a picker
    // and connections land on the legacy org-wide row.
    prisma.property.findMany({
      where: { orgId: scope.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // pendingPixelRequest remains for the legacy ops-fulfillment queue.
    // The new one-flow setup does not enqueue an ops request — webhook
    // URL is minted client-side and pixel_id auto-binds from the first
    // event. We still surface a pending request here if one exists from
    // before the one-flow rollout so customers in that state see the
    // expected "awaiting ops" copy until they re-run the connect step.
    prisma.pixelProvisionRequest.findFirst({
      where: { orgId: scope.orgId, status: PixelRequestStatus.PENDING },
      orderBy: { requestedAt: "desc" },
      select: { id: true, websiteName: true, websiteUrl: true, requestedAt: true },
    }),
    // Per-property panel pulls in every cursive integration row (so it can
    // render both the legacy NULL row and any per-property rows in its
    // matrix). Hoisted into the main fan-out so it parallelizes with the
    // rest instead of running serially after the page already loaded.
    prisma.cursiveIntegration.findMany({
      where: { orgId: scope.orgId },
      select: { propertyId: true, cursivePixelId: true },
    }),
  ]);

  if (!org) return null;

  const pixelProvisioned = Boolean(pixel?.cursivePixelId);
  const pixelInstallSnippet = pixel?.cursivePixelId
    ? `<script src="https://cdn.idpixel.app/v1/idp-analytics-${pixel.cursivePixelId}.min.js" defer></script>`
    : null;
  const pixelEligible = org.modulePixel || org.moduleChatbot;
  // The setup wizard is mid-flow when we minted a webhook token but
  // haven't yet captured a pixel_id from a real AL event. Pre-fill the
  // wizard so a refresh / re-open doesn't lose state.
  const pixelSetupInFlight =
    !pixelProvisioned && Boolean(pixel?.webhookToken);
  const pixelWebhookUrlInFlight = pixelSetupInFlight && pixel?.webhookToken
    ? `${
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
        "https://leasestack.co"
      }/api/webhooks/cursive/${pixel.webhookToken}`
    : null;

  const appfolioConnected =
    !!appfolio &&
    !!appfolio.instanceSubdomain &&
    (!!appfolio.clientIdEncrypted || !!appfolio.useEmbedFallback);

  const manageSlots: Record<string, React.ReactNode> = {
    "visitor-identification": pixelProvisioned ? (
      <PixelManage
        pixelId={pixel!.cursivePixelId!}
        installedOnDomain={pixel!.installedOnDomain ?? null}
        provisionedAt={pixel!.provisionedAt ?? null}
        lastEventAt={pixel!.lastEventAt ?? null}
        totalEventsCount={pixel!.totalEventsCount ?? 0}
        lastPixelHitAt={pixel!.lastPixelHitAt ?? null}
        totalPixelHitsCount={pixel!.totalPixelHitsCount ?? 0}
        installSnippet={pixelInstallSnippet}
      />
    ) : pixelSetupInFlight ? (
      <CursiveSetupWizard
        defaultWebsiteUrl={
          pixel?.installedOnDomain ? `https://${pixel.installedOnDomain}` : ""
        }
        properties={properties}
        initialWebhookUrl={pixelWebhookUrlInFlight}
        initialLastEventAt={pixel?.lastEventAt?.toISOString() ?? null}
        initialPixelId={pixel?.cursivePixelId ?? null}
      />
    ) : pendingPixelRequest ? (
      <PixelRequestPending
        websiteName={pendingPixelRequest.websiteName}
        websiteUrl={pendingPixelRequest.websiteUrl}
        requestedAt={pendingPixelRequest.requestedAt}
      />
    ) : pixelEligible ? (
      <CursiveSetupWizard
        defaultWebsiteUrl=""
        properties={properties}
      />
    ) : (
      <div className="rounded-md border border-border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">
          Visitor identification isn&apos;t enabled on your current plan.
          Talk to your account manager to turn it on.
        </p>
      </div>
    ),
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
    gsc: (() => {
      // Manage-card displays the LEGACY org-wide GSC row. Per-property
      // rows show up in the Per-Property panel below this section so
      // each card stays focused on its scope. Falls back to the first
      // GSC row of any kind so single-property orgs that happened to
      // wire their connection to a property still see a manage card.
      const gscRows = seoIntegrations.filter(
        (s) => s.provider === SeoProvider.GSC,
      );
      const row =
        gscRows.find((r) => r.propertyId === null) ?? gscRows[0] ?? null;
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
        <ConnectSeoForm
          provider="GSC"
          properties={properties.length > 1 ? properties : []}
        />
      );
    })(),
    ga4: (() => {
      // Same legacy-first selection as GSC above.
      const ga4Rows = seoIntegrations.filter(
        (s) => s.provider === SeoProvider.GA4,
      );
      const row =
        ga4Rows.find((r) => r.propertyId === null) ?? ga4Rows[0] ?? null;
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
        <ConnectSeoForm
          provider="GA4"
          properties={properties.length > 1 ? properties : []}
        />
      );
    })(),
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
              <OAuthConnectButton provider="google_ads" />
              <details className="group rounded-md border border-border bg-card">
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
              <OAuthConnectButton provider="meta_ads" />
              <details className="group rounded-md border border-border bg-card">
                <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground px-3 py-2 hover:text-foreground select-none">
                  Advanced — paste a system-user token manually
                </summary>
                <div className="px-3 pb-3 pt-1 border-t border-border">
                  <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                    For agencies that already manage a Meta Business
                    system-user token. Most operators should use the Connect
                    button above.
                  </p>
                  <ConnectMetaAdsForm />
                </div>
              </details>
            </div>
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
      <PerPropertyIntegrationsPanel
        properties={properties}
        seoRows={seoIntegrations.map((s) => ({
          provider: s.provider,
          propertyId: s.propertyId,
          propertyIdentifier: s.propertyIdentifier,
        }))}
        cursiveRows={allCursiveRows}
      />
      <CalWebhookPanel orgId={scope.orgId} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalWebhookPanel — surfaces the per-org Cal.com webhook URL the operator
// can paste into any Cal.com webhook subscription. When a prospect books a
// slot, the receiver creates a Lead (source=REFERRAL, sourceDetail=cal.com)
// + a Tour scoped to the org's default property. See
// app/api/webhooks/cal/[orgId]/route.ts for the full contract.
// ---------------------------------------------------------------------------
function CalWebhookPanel({ orgId }: { orgId: string }) {
  const url = `${(process.env.NEXT_PUBLIC_APP_URL ?? "https://leasestack.co").replace(/\/$/, "")}/api/webhooks/cal/${orgId}`;
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Cal.com bookings → Leads
          </h3>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-xl leading-relaxed">
            Paste this URL as the Subscriber URL on any Cal.com webhook
            (Booking created / rescheduled / cancelled). Every booking
            becomes a Lead + Tour in your portal automatically.
          </p>
        </div>
      </div>
      <code className="block rounded-md border border-border bg-background px-3 py-2 text-[11.5px] font-mono text-foreground overflow-x-auto whitespace-nowrap">
        {url}
      </code>
      <ol className="text-[11.5px] text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
        <li>Cal.com → Settings → Developer → Webhooks → New webhook</li>
        <li>Paste the URL above into Subscriber URL</li>
        <li>
          Check: Booking created · Booking rescheduled · Booking cancelled
        </li>
        <li>Save. New bookings appear on /portal/leads within seconds.</li>
      </ol>
    </section>
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
  lastPixelHitAt,
  totalPixelHitsCount,
  installSnippet,
}: {
  pixelId: string;
  installedOnDomain: string | null;
  provisionedAt: Date | null;
  lastEventAt: Date | null;
  totalEventsCount: number;
  // Raw pixel-hit pulse — every webhook event regardless of resolution.
  // See lib/webhooks/cursive-process.ts for the split rationale.
  lastPixelHitAt: Date | null;
  totalPixelHitsCount: number;
  installSnippet: string | null;
}) {
  // "Verified" means we've seen ANY pixel hit — including anonymous ones.
  // Before the pixel-hit telemetry split this used `lastEventAt`, which
  // only ticked on resolved identities, so a freshly installed pixel
  // firing thousands of anonymous pageviews would still read "Pending
  // verification" until the first resolution landed (often hours later).
  const verified = Boolean(lastPixelHitAt ?? lastEventAt);
  return (
    <div className="space-y-5">
      {/* Pending → Connected transition. Operators install the snippet and
          immediately want to know if events are flowing — the badge ticks
          every 15s and flips from amber "Pending verification" to a green
          "Last event Xs ago" the moment the first webhook lands. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <CursiveWebhookBadge
          lastEventAtIso={
            (lastPixelHitAt ?? lastEventAt)?.toISOString() ?? null
          }
          totalEventsCount={totalPixelHitsCount || totalEventsCount}
        />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {verified ? "Connected" : "Pending verification"}
        </span>
      </div>
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
        {/* Split telemetry: pixel hits include every webhook the pixel
            fires (anonymous + identified); resolved identities is the
            subset where AL had enough data to attach a name/email/HEM.
            Operators used to see only the resolved count, which on a
            new pixel can sit at single digits for days while the pixel
            fires thousands of hits per hour — the panel looked dead. */}
        <DetailRow
          label="Pixel hits"
          value={
            lastPixelHitAt
              ? formatDistanceToNow(lastPixelHitAt, { addSuffix: true })
              : "No hits yet"
          }
          hint={
            totalPixelHitsCount > 0
              ? `${totalPixelHitsCount.toLocaleString()} total hits`
              : undefined
          }
        />
        <DetailRow
          label="Resolved identities"
          value={
            lastEventAt
              ? formatDistanceToNow(lastEventAt, { addSuffix: true })
              : "No identities yet"
          }
          hint={
            totalEventsCount > 0
              ? `${totalEventsCount.toLocaleString()} total identified`
              : undefined
          }
        />
      </dl>

      {installSnippet ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium text-foreground">
              Install snippet
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
            where you want visitor identification to run. Named visitors
            start showing up in your portal within a few minutes of the first
            pageview.
          </p>
        </div>
      ) : null}

      <DisconnectPixelForm />
    </div>
  );
}

// Shown after a customer submits the connect form but before ops has
// finished setting up the upstream pixel. Reassures them the request
// is in flight without any of the dual-pixel UI.
function PixelRequestPending({
  websiteName,
  websiteUrl,
  requestedAt,
}: {
  websiteName: string;
  websiteUrl: string;
  requestedAt: Date;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-muted/40 animate-pulse" />
        <h3 className="text-sm font-semibold">Setting up your pixel</h3>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <DetailRow label="Website" value={websiteName} />
        <DetailRow label="URL" value={websiteUrl} mono />
        <DetailRow
          label="Requested"
          value={formatDistanceToNow(requestedAt, { addSuffix: true })}
        />
      </dl>
      <p className="text-[12px] text-muted-foreground leading-relaxed">
        Our team is provisioning your identity-resolution pixel. We&apos;ll
        email you the install snippet within one business day — usually much
        sooner. You&apos;ll be able to paste it into the head of your site and
        named visitors will start showing up in your portal within a few
        minutes of the first pageview.
      </p>
    </div>
  );
}

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
  return (
    <div className="space-y-5">
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
        <p className="text-[11px] text-destructive rounded-md border border-destructive/30 bg-destructive/10 p-3">
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
        <p className="text-[11px] text-destructive rounded-md border border-destructive/30 bg-destructive/10 p-3">
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
