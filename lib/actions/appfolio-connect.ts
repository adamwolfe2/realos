"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireScope, auditPayload } from "@/lib/tenancy/scope";
import { encrypt } from "@/lib/crypto";
import {
  testAppFolioConnection,
} from "@/lib/integrations/appfolio";
import {
  runAppfolioSync,
  type AppfolioSyncStats,
} from "@/lib/integrations/appfolio-sync";
import { AuditAction, BackendPlatform } from "@prisma/client";

// ---------------------------------------------------------------------------
// AppFolio REST connect / disconnect / manual-sync server actions.
//
// Trust path: the portal form submits plaintext clientId / clientSecret once,
// we run a live `testAppFolioConnection` against AppFolio before persisting,
// and only on success do we encrypt + store. Credentials are never returned
// to the client after creation — the read path only ever surfaces
// `hasCreds`, `lastSyncAt`, etc.
// ---------------------------------------------------------------------------

const PORTAL_PATH = "/portal/settings/integrations";
const PORTAL_HOME = "/portal";

const subdomainRegex = /^[a-z0-9][a-z0-9-]*$/;

function normalizeSubdomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\.appfolio\.com.*$/i, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9-]/g, "");
}

const connectSchema = z.object({
  subdomain: z
    .string()
    .trim()
    .min(1, "Subdomain is required")
    .max(200)
    .transform(normalizeSubdomain)
    .refine((v) => subdomainRegex.test(v), {
      message:
        "Subdomain must look like 'sgrealestate' (no dots, no https://).",
    }),
  clientId: z
    .string()
    .trim()
    .min(4, "Client ID is required")
    .max(500),
  clientSecret: z
    .string()
    .trim()
    .min(4, "Client secret is required")
    .max(500),
  plan: z.enum(["core", "plus", "max"]).optional(),
});

export type ConnectAppfolioResult =
  | { ok: true }
  | { ok: false; error: string };

export type SyncAppfolioResult =
  | { ok: true; stats: AppfolioSyncStats }
  | { ok: false; error: string; stats?: AppfolioSyncStats };

export async function connectAppfolio(
  formData: FormData
): Promise<ConnectAppfolioResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const parsed = connectSchema.safeParse({
    subdomain: formData.get("subdomain")?.toString() ?? "",
    clientId: formData.get("clientId")?.toString() ?? "",
    clientSecret: formData.get("clientSecret")?.toString() ?? "",
    plan: formData.get("plan")?.toString() || undefined,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input";
    return { ok: false, error: first };
  }
  const { subdomain, clientId, clientSecret, plan } = parsed.data;

  const clientIdEncrypted = encrypt(clientId);
  const clientSecretEncrypted = encrypt(clientSecret);

  // Ephemeral integration object passed to the live connection test. We do
  // NOT persist until the test passes.
  const testIntegration = {
    id: "test",
    orgId: scope.orgId,
    instanceSubdomain: subdomain,
    plan: plan ?? null,
    apiKeyEncrypted: null,
    clientIdEncrypted,
    clientSecretEncrypted,
    oauthTokenEncrypted: null,
    oauthRefreshEncrypted: null,
    oauthExpiresAt: null,
    lastSyncAt: null,
    syncStatus: null,
    lastError: null,
    propertyGroupFilter: null,
    syncFrequencyMinutes: 60,
    autoSyncEnabled: true,
    useEmbedFallback: false,
    embedScriptConfig: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Parameters<typeof testAppFolioConnection>[0];

  const probe = await testAppFolioConnection(testIntegration);
  if (!probe.ok) {
    return {
      ok: false,
      error: `AppFolio rejected the connection: ${probe.error}`,
    };
  }

  const existing = await prisma.appFolioIntegration.findUnique({
    where: { orgId: scope.orgId },
    select: { id: true },
  });

  const integration = await prisma.appFolioIntegration.upsert({
    where: { orgId: scope.orgId },
    create: {
      orgId: scope.orgId,
      instanceSubdomain: subdomain,
      plan: plan ?? null,
      clientIdEncrypted,
      clientSecretEncrypted,
      autoSyncEnabled: true,
      syncFrequencyMinutes: 60,
      useEmbedFallback: false,
      syncStatus: "idle",
      lastError: null,
    },
    update: {
      instanceSubdomain: subdomain,
      plan: plan ?? null,
      clientIdEncrypted,
      clientSecretEncrypted,
      autoSyncEnabled: true,
      useEmbedFallback: false,
      syncStatus: "idle",
      lastError: null,
    },
  });

  // Any NONE-platform property on this org defaults to AppFolio now.
  await prisma.property.updateMany({
    where: {
      orgId: scope.orgId,
      backendPlatform: BackendPlatform.NONE,
    },
    data: { backendPlatform: BackendPlatform.APPFOLIO },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.SETTING_CHANGE,
      entityType: "AppFolioIntegration",
      entityId: integration.id,
      description: existing
        ? "AppFolio credentials rotated"
        : "AppFolio connected",
    }),
  });

  // Fire-and-forget initial backfill. We don't await so the portal UI isn't
  // blocked — the tile will poll the integration status on next render.
  void runAppfolioSync(scope.orgId, { fullBackfill: true }).catch((err) => {
    console.warn("[appfolio-connect] initial sync error", err);
  });

  revalidatePath(PORTAL_PATH);
  revalidatePath(PORTAL_HOME);
  return { ok: true };
}

export async function disconnectAppfolio(): Promise<ConnectAppfolioResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const existing = await prisma.appFolioIntegration.findUnique({
    where: { orgId: scope.orgId },
    select: { id: true },
  });
  if (!existing) return { ok: true };

  await prisma.appFolioIntegration.update({
    where: { orgId: scope.orgId },
    data: {
      clientIdEncrypted: null,
      clientSecretEncrypted: null,
      apiKeyEncrypted: null,
      oauthTokenEncrypted: null,
      oauthRefreshEncrypted: null,
      oauthExpiresAt: null,
      autoSyncEnabled: false,
      syncStatus: "idle",
      lastError: null,
    },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.SETTING_CHANGE,
      entityType: "AppFolioIntegration",
      entityId: existing.id,
      description: "AppFolio disconnected",
    }),
  });

  revalidatePath(PORTAL_PATH);
  revalidatePath(PORTAL_HOME);
  return { ok: true };
}

export async function triggerAppfolioSync(): Promise<SyncAppfolioResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const result = await runAppfolioSync(scope.orgId);

  revalidatePath(PORTAL_PATH);
  revalidatePath(PORTAL_HOME);

  if (!result.ok) {
    return {
      ok: false,
      error: result.error ?? "Sync failed",
      stats: result.stats,
    };
  }
  return { ok: true, stats: result.stats };
}
