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
  // Optional LeaseStack property to scope this connection to. When
  // omitted (or empty string) the connection lands on the legacy
  // org-wide row (propertyId = NULL) so single-property tenants don't
  // need to think about scoping. Multi-property tenants pass a real
  // property id so each domain's GA4/GSC is independent.
  leasestackPropertyId: z
    .string()
    .trim()
    .max(60)
    .optional()
    .nullable(),
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
    leasestackPropertyId:
      formData.get("leasestackPropertyId")?.toString() || null,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  if (!serviceAccountJson) {
    return {
      ok: false,
      error:
        "Google service account not configured. Contact your administrator.",
    };
  }

  const { provider, propertyIdentifier, leasestackPropertyId } = parsed.data;
  const scopePropertyId =
    leasestackPropertyId && leasestackPropertyId.length > 0
      ? leasestackPropertyId
      : null;

  // If a property was specified, validate it belongs to this org —
  // never trust a hidden form field. A bogus / cross-tenant id is
  // silently coerced to NULL (legacy org-wide) rather than failing the
  // connect, but we'll log a warning for ops visibility.
  let validatedScopePropertyId: string | null = null;
  if (scopePropertyId) {
    const found = await prisma.property.findFirst({
      where: { id: scopePropertyId, orgId: scope.orgId },
      select: { id: true },
    });
    if (found) {
      validatedScopePropertyId = found.id;
    } else {
      console.warn(
        "[seo-connect] propertyId not found for org; falling back to org-wide",
        { orgId: scope.orgId, propertyId: scopePropertyId },
      );
    }
  }

  let parsedSa;
  try {
    parsedSa = parseServiceAccountJson(serviceAccountJson);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    return { ok: false, error: message };
  }

  // Use the sanitised canonical JSON everywhere downstream. parseServiceAccountJson
  // fixes the common Vercel-env-var-with-raw-newlines case and re-serialises
  // with proper "\n" escapes. Persisting this form also prevents every later
  // sync from re-doing the sanitisation.
  const canonicalSaJson = parsedSa.raw;

  // Probe before persisting.
  let permissionLevel: string | null | undefined;
  let propertyDisplayName: string | null | undefined;
  if (provider === "GSC") {
    const probe = await testGscConnection(canonicalSaJson, propertyIdentifier);
    if (!probe.ok) return { ok: false, error: probe.error };
    permissionLevel = probe.permissionLevel;
  } else {
    const probe = await testGa4Connection(canonicalSaJson, propertyIdentifier);
    if (!probe.ok) return { ok: false, error: probe.error };
    propertyDisplayName = probe.propertyDisplayName;
  }

  const encryptedJson = encrypt(canonicalSaJson);
  const providerEnum =
    provider === "GSC" ? SeoProvider.GSC : SeoProvider.GA4;

  // Lookup-then-update-or-create rather than upsert because Prisma's
  // compound unique key won't accept NULL on the propertyId leg of
  // (orgId, propertyId, provider). Per-property writes can still use
  // the compound key directly via findUnique, but for consistency we
  // funnel everything through findFirst here.
  const existing = await prisma.seoIntegration.findFirst({
    where: {
      orgId: scope.orgId,
      propertyId: validatedScopePropertyId,
      provider: providerEnum,
    },
    select: { id: true },
  });

  const integration = existing
    ? await prisma.seoIntegration.update({
        where: { id: existing.id },
        data: {
          propertyIdentifier,
          serviceAccountEmail: parsedSa.email,
          serviceAccountJsonEncrypted: encryptedJson,
          status: SeoSyncStatus.IDLE,
          lastSyncError: null,
        },
      })
    : await prisma.seoIntegration.create({
        data: {
          orgId: scope.orgId,
          propertyId: validatedScopePropertyId,
          provider: providerEnum,
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
  // Disconnect a specific property's integration. Empty / unset
  // disconnects the legacy org-wide row. Multi-property tenants pass
  // a real id to remove just that property's connection.
  leasestackPropertyId: z
    .string()
    .trim()
    .max(60)
    .optional()
    .nullable(),
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
    leasestackPropertyId:
      formData.get("leasestackPropertyId")?.toString() || null,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid provider" };
  }

  const providerEnum =
    parsed.data.provider === "GSC" ? SeoProvider.GSC : SeoProvider.GA4;
  const scopePropertyId =
    parsed.data.leasestackPropertyId &&
    parsed.data.leasestackPropertyId.length > 0
      ? parsed.data.leasestackPropertyId
      : null;

  const existing = await prisma.seoIntegration.findFirst({
    where: {
      orgId: scope.orgId,
      propertyId: scopePropertyId,
      provider: providerEnum,
    },
    select: { id: true },
  });
  if (!existing) {
    return { ok: true, provider: parsed.data.provider };
  }

  await prisma.seoIntegration.delete({
    where: { id: existing.id },
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
