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
import {
  ConnectAppfolioForm,
  DisconnectAppfolioForm,
  SyncAppfolioButton,
} from "./appfolio-forms";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const scope = await requireScope();
  const [org, pixel, appfolio, statuses] = await Promise.all([
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
    resolveIntegrationStatuses(scope.orgId),
  ]);

  if (!org) return null;

  const pixelProvisioned = Boolean(pixel?.cursivePixelId);
  const pixelInstallSnippet = pixel?.pixelScriptUrl
    ? `<script src="${pixel.pixelScriptUrl}" async></script>`
    : null;
  const pixelEligible = org.modulePixel || org.moduleChatbot;

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
      />
    ) : pixelEligible ? (
      <ConnectPixelForm defaultWebsiteName={org.name} />
    ) : (
      <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/30 p-3">
        Your workspace doesn&apos;t have the visitor identification module
        enabled. Contact your account manager to turn it on before connecting.
      </p>
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
}: {
  pixelId: string;
  installedOnDomain: string | null;
  provisionedAt: Date | null;
  lastEventAt: Date | null;
  totalEventsCount: number;
  installSnippet: string | null;
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
              Install snippet
            </span>
            <CopySnippetButton snippet={installSnippet} />
          </div>
          <pre className="rounded-md border border-border bg-muted/50 p-3 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all text-foreground">
            {installSnippet}
          </pre>
          <p className="text-[11px] text-muted-foreground">
            Paste this tag into the {"<head>"} of every page on your site
            where you want visitor identification to run.
          </p>
        </div>
      ) : null}

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
