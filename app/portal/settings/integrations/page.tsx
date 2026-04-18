import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
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
  const [org, integration, appfolio] = await Promise.all([
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
  ]);

  if (!org) return null;

  const appfolioConnected =
    !!appfolio &&
    !!appfolio.instanceSubdomain &&
    (!!appfolio.clientIdEncrypted || !!appfolio.apiKeyEncrypted);

  const isProvisioned = Boolean(integration?.cursivePixelId);
  const installSnippet = integration?.pixelScriptUrl
    ? `<script src="${integration.pixelScriptUrl}" async></script>`
    : null;
  const eligible = org.modulePixel || org.moduleChatbot;

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-2">
        <Link
          href="/portal/settings"
          className="text-xs opacity-60 underline underline-offset-2"
        >
          ← Settings
        </Link>
        <h1 className="font-serif text-3xl font-bold">Integrations</h1>
        <p className="text-sm opacity-60">
          Connect the Cursive visitor pixel and other third-party services
          used by your workspace.
        </p>
      </header>

      <section className="border rounded-md p-5 space-y-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold">Cursive pixel</h2>
            <p className="text-xs opacity-60 mt-1">
              Install the Cursive SuperPixel on your marketing site to
              identify anonymous visitors and feed them into your CRM.
            </p>
          </div>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
              isProvisioned
                ? "bg-emerald-100 text-emerald-800"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isProvisioned ? "Connected" : "Not connected"}
          </span>
        </div>

        {!isProvisioned ? (
          eligible ? (
            <ConnectPixelForm defaultWebsiteName={org.name} />
          ) : (
            <p className="text-xs opacity-70 border rounded p-3 bg-muted">
              Your workspace doesn't have the Pixel or Chatbot module
              enabled. Contact your account manager to turn it on before
              connecting.
            </p>
          )
        ) : (
          <ProvisionedView
            pixelId={integration!.cursivePixelId!}
            installedOnDomain={integration!.installedOnDomain ?? null}
            provisionedAt={integration!.provisionedAt ?? null}
            lastEventAt={integration!.lastEventAt ?? null}
            totalEventsCount={integration!.totalEventsCount ?? 0}
            installSnippet={installSnippet}
          />
        )}
      </section>

      <section className="border rounded-md p-5 space-y-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold">AppFolio</h2>
            <p className="text-xs opacity-60 mt-1">
              Sync leads, showings, tenants, and available listings from your
              AppFolio instance into RealEstaite. Requires the AppFolio Plus
              or Max plan and a Developer Portal client ID + secret.
            </p>
          </div>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
              appfolioConnected
                ? "bg-emerald-100 text-emerald-800"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {appfolioConnected ? "Connected" : "Not connected"}
          </span>
        </div>

        {!appfolioConnected ? (
          <ConnectAppfolioForm />
        ) : (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <DetailRow
                label="Subdomain"
                value={appfolio!.instanceSubdomain || "—"}
                mono
              />
              <DetailRow
                label="Plan"
                value={appfolio!.plan ? appfolio!.plan.toUpperCase() : "—"}
              />
              <DetailRow
                label="Last sync"
                value={
                  appfolio!.lastSyncAt
                    ? formatDistanceToNow(appfolio!.lastSyncAt, {
                        addSuffix: true,
                      })
                    : "Never"
                }
              />
              <DetailRow
                label="Status"
                value={appfolio!.syncStatus ?? "idle"}
                hint={
                  appfolio!.lastError ?? undefined
                }
              />
            </dl>

            {appfolio!.lastError ? (
              <p className="text-[11px] text-destructive border border-destructive/40 rounded p-2 bg-destructive/5">
                {appfolio!.lastError}
              </p>
            ) : null}

            <SyncAppfolioButton />

            <DisconnectAppfolioForm />
          </div>
        )}
      </section>
    </div>
  );
}

function ProvisionedView({
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
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
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
            <span className="text-xs tracking-widest uppercase opacity-70">
              Install snippet
            </span>
            <CopySnippetButton snippet={installSnippet} />
          </div>
          <pre className="border rounded p-3 bg-muted text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
            {installSnippet}
          </pre>
          <p className="text-[11px] opacity-60">
            Paste this tag into the {"<head>"} of every page on your site
            where you want visitor identification to run.
          </p>
        </div>
      ) : null}

      <DisconnectPixelForm />
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
      <dt className="text-xs tracking-widest uppercase opacity-70">{label}</dt>
      <dd
        className={`text-sm mt-0.5 break-all ${mono ? "font-mono" : ""}`}
      >
        {value}
      </dd>
      {hint ? <div className="text-[11px] opacity-60 mt-0.5">{hint}</div> : null}
    </div>
  );
}
