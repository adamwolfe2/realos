"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireScope, auditPayload } from "@/lib/tenancy/scope";
import { encrypt } from "@/lib/crypto";
import { parseServiceAccountJson, testGscConnection } from "@/lib/integrations/gsc";
import { testGa4Connection } from "@/lib/integrations/ga4";
import { runSeoSync, type SeoSyncStats } from "@/lib/integrations/seo-sync";
import { AuditAction, SeoProvider, SeoSyncStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// SEO connect / disconnect / manual-sync server actions.
//
// Auth path is identical for GSC and GA4: paste the service account JSON file
// downloaded from Google Cloud Console (IAM → Service Accounts → Keys → Add
// JSON key). The service account email must be added as:
//   - GSC: a user with "Full" or "Restricted" permission on the property
//   - GA4: a "Viewer" on the GA4 property
//
// Property identifier per provider:
//   - GSC: "https://www.example.com/" (URL-prefix) or "sc-domain:example.com"
//   - GA4: numeric property ID, e.g. "338445667"
// ---------------------------------------------------------------------------

const PORTAL_PATH = "/portal/seo";
const PORTAL_HOME = "/portal";

const connectSchema = z.object({
  provider: z.enum(["GSC", "GA4"]),
  propertyIdentifier: z
    .string()
    .trim()
    .min(1, "Property identifier is required")
    .max(500),
  serviceAccountJson: z
    .string()
    .trim()
    .min(20, "Paste the full service account JSON file."),
});

export type ConnectSeoResult =
  | {
      ok: true;
      provider: "GSC" | "GA4";
      propertyDisplayName?: string | null;
      permissionLevel?: string | null;
    }
  | { ok: false; error: string };

export type SyncSeoResult =
  | { ok: true; stats: SeoSyncStats }
  | { ok: false; error: string; stats?: SeoSyncStats };

export async function connectSeo(formData: FormData): Promise<ConnectSeoResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const parsed = connectSchema.safeParse({
    provider: formData.get("provider")?.toString() ?? "",
    propertyIdentifier: formData.get("propertyIdentifier")?.toString() ?? "",
    serviceAccountJson: formData.get("serviceAccountJson")?.toString() ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { provider, propertyIdentifier, serviceAccountJson } = parsed.data;

  let parsedSa;
  try {
    parsedSa = parseServiceAccountJson(serviceAccountJson);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    return { ok: false, error: message };
  }

  // Probe before persisting.
  let permissionLevel: string | null | undefined;
  let propertyDisplayName: string | null | undefined;
  if (provider === "GSC") {
    const probe = await testGscConnection(serviceAccountJson, propertyIdentifier);
    if (!probe.ok) return { ok: false, error: probe.error };
    permissionLevel = probe.permissionLevel;
  } else {
    const probe = await testGa4Connection(serviceAccountJson, propertyIdentifier);
    if (!probe.ok) return { ok: false, error: probe.error };
    propertyDisplayName = probe.propertyDisplayName;
  }

  const encryptedJson = encrypt(serviceAccountJson);
  const providerEnum =
    provider === "GSC" ? SeoProvider.GSC : SeoProvider.GA4;

  const existing = await prisma.seoIntegration.findUnique({
    where: { orgId_provider: { orgId: scope.orgId, provider: providerEnum } },
    select: { id: true },
  });

  const integration = await prisma.seoIntegration.upsert({
    where: { orgId_provider: { orgId: scope.orgId, provider: providerEnum } },
    create: {
      orgId: scope.orgId,
      provider: providerEnum,
      propertyIdentifier,
      serviceAccountEmail: parsedSa.email,
      serviceAccountJsonEncrypted: encryptedJson,
      status: SeoSyncStatus.IDLE,
      lastSyncError: null,
    },
    update: {
      propertyIdentifier,
      serviceAccountEmail: parsedSa.email,
      serviceAccountJsonEncrypted: encryptedJson,
      status: SeoSyncStatus.IDLE,
      lastSyncError: null,
    },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.SETTING_CHANGE,
      entityType: "SeoIntegration",
      entityId: integration.id,
      description: existing
        ? `${provider} reconnected`
        : `${provider} connected`,
    }),
  });

  // Fire-and-forget initial backfill.
  void runSeoSync(scope.orgId, { fullBackfill: true }).catch((err) => {
    console.warn("[seo-connect] initial sync error", err);
  });

  revalidatePath(PORTAL_PATH);
  revalidatePath(PORTAL_HOME);

  return {
    ok: true,
    provider,
    propertyDisplayName: propertyDisplayName ?? null,
    permissionLevel: permissionLevel ?? null,
  };
}

const disconnectSchema = z.object({
  provider: z.enum(["GSC", "GA4"]),
});

export async function disconnectSeo(
  formData: FormData,
): Promise<ConnectSeoResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const parsed = disconnectSchema.safeParse({
    provider: formData.get("provider")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid provider" };
  }

  const providerEnum =
    parsed.data.provider === "GSC" ? SeoProvider.GSC : SeoProvider.GA4;

  const existing = await prisma.seoIntegration.findUnique({
    where: { orgId_provider: { orgId: scope.orgId, provider: providerEnum } },
    select: { id: true },
  });
  if (!existing) {
    return { ok: true, provider: parsed.data.provider };
  }

  await prisma.seoIntegration.delete({
    where: { orgId_provider: { orgId: scope.orgId, provider: providerEnum } },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.SETTING_CHANGE,
      entityType: "SeoIntegration",
      entityId: existing.id,
      description: `${parsed.data.provider} disconnected`,
    }),
  });

  revalidatePath(PORTAL_PATH);
  revalidatePath(PORTAL_HOME);
  return { ok: true, provider: parsed.data.provider };
}

export async function triggerSeoSync(): Promise<SyncSeoResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not authorized";
    return { ok: false, error: message };
  }

  const result = await runSeoSync(scope.orgId, { fullBackfill: true });

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
