import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { AppFolioForm } from "./appfolio-form";

export const metadata: Metadata = { title: "AppFolio integration" };
export const dynamic = "force-dynamic";

export default async function AppFolioSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;

  const property = await prisma.property.findFirst({
    where: { id, ...tenantWhere(scope) },
    select: {
      id: true,
      name: true,
      backendPlatform: true,
      backendPropertyGroup: true,
      lastSyncedAt: true,
      syncError: true,
    },
  });
  if (!property) notFound();

  const integration = await prisma.appFolioIntegration.findUnique({
    where: { orgId: scope.orgId },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <Link
          href={`/portal/properties/${property.id}`}
          className="text-xs opacity-60 hover:opacity-100"
        >
          ← {property.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">
          AppFolio integration
        </h1>
        <p className="text-sm opacity-60 mt-1">
          Pull live listings from AppFolio and let them flow into your
          marketing site. Embed-scrape mode works for any tenant; REST
          mode requires an AppFolio Plus API key.
        </p>
      </header>
      {property.syncError ? (
        <div className="border border-destructive/40 rounded-md p-3 text-sm text-destructive">
          Last sync error: {property.syncError}
        </div>
      ) : null}
      <AppFolioForm
        initial={
          integration
            ? {
                instanceSubdomain: integration.instanceSubdomain,
                propertyGroupFilter: integration.propertyGroupFilter,
                useEmbedFallback: integration.useEmbedFallback,
                autoSyncEnabled: integration.autoSyncEnabled,
                syncFrequencyMinutes: integration.syncFrequencyMinutes,
                hasApiKey: !!integration.apiKeyEncrypted,
                lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
                syncStatus: integration.syncStatus,
              }
            : null
        }
      />
    </div>
  );
}
