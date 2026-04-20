"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireScope, auditPayload } from "@/lib/tenancy/scope";
import { encrypt } from "@/lib/crypto";
import {
  normalizeMetaAdAccountId,
  testMetaAdsConnection,
  type MetaAdsCredentials,
} from "@/lib/integrations/meta-ads";
import { runAdsSyncForAccount } from "@/lib/integrations/ads-sync";
import { AdPlatform, AuditAction } from "@prisma/client";

// ---------------------------------------------------------------------------
// Meta Ads (Facebook + Instagram) connect / disconnect / sync server actions.
//
// V1 auth (no OAuth): the operator pastes:
//   - System User access token   (generated in Business Manager)
//   - Ad account ID              (numeric; we accept act_ prefix and strip)
// We hit /act_<id>?fields=id,name,currency to validate before persisting.
// ---------------------------------------------------------------------------

const PORTAL_INTEGRATIONS = "/portal/settings/integrations";
const PORTAL_ADS = "/portal/ads";

const connectSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  systemUserAccessToken: z
    .string()
    .trim()
    .min(40, "System user access token looks too short")
    .max(2048),
  adAccountId: z
    .string()
    .trim()
    .min(6, "Ad account ID is required")
    .max(64)
    .transform((v) => normalizeMetaAdAccountId(v))
    .refine((v) => v.length >= 6, {
      message: "Ad account ID should be the numeric value from Meta Ads Manager",
    }),
});

export type ConnectMetaAdsResult =
  | {
      ok: true;
      accountId: string;
      currency: string | null;
      accountName: string | null;
    }
  | { ok: false; error: string };

export async function connectMetaAds(
  formData: FormData
): Promise<ConnectMetaAdsResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not authorized",
    };
  }

  const parsed = connectSchema.safeParse({
    displayName: formData.get("displayName")?.toString() || undefined,
    systemUserAccessToken: formData.get("systemUserAccessToken")?.toString() ?? "",
    adAccountId: formData.get("adAccountId")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const creds: MetaAdsCredentials = {
    systemUserAccessToken: parsed.data.systemUserAccessToken,
  };

  const probe = await testMetaAdsConnection(creds, parsed.data.adAccountId);
  if (!probe.ok) {
    return {
      ok: false,
      error: `Meta Ads rejected the credentials: ${probe.error}`,
    };
  }

  const credentialsEncrypted = encrypt(JSON.stringify(creds));

  const existing = await prisma.adAccount.findUnique({
    where: {
      orgId_platform_externalAccountId: {
        orgId: scope.orgId,
        platform: AdPlatform.META,
        externalAccountId: parsed.data.adAccountId,
      },
    },
    select: { id: true },
  });

  const account = await prisma.adAccount.upsert({
    where: {
      orgId_platform_externalAccountId: {
        orgId: scope.orgId,
        platform: AdPlatform.META,
        externalAccountId: parsed.data.adAccountId,
      },
    },
    create: {
      orgId: scope.orgId,
      platform: AdPlatform.META,
      externalAccountId: parsed.data.adAccountId,
      displayName: parsed.data.displayName ?? probe.name ?? "Meta Ads",
      currency: probe.currency ?? "USD",
      credentialsEncrypted,
      accessStatus: "active",
      autoSyncEnabled: true,
    },
    update: {
      displayName: parsed.data.displayName ?? probe.name ?? "Meta Ads",
      currency: probe.currency ?? "USD",
      credentialsEncrypted,
      accessStatus: "active",
      autoSyncEnabled: true,
      lastSyncError: null,
    },
  });

  await prisma.organization.update({
    where: { id: scope.orgId },
    data: { moduleMetaAds: true },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.SETTING_CHANGE,
      entityType: "AdAccount",
      entityId: account.id,
      description: existing ? "Meta Ads reconnected" : "Meta Ads connected",
    }),
  });

  void runAdsSyncForAccount(account.id, { fullBackfill: true }).catch((err) => {
    console.warn("[meta-ads-connect] initial sync error", err);
  });

  revalidatePath(PORTAL_INTEGRATIONS);
  revalidatePath(PORTAL_ADS);
  return {
    ok: true,
    accountId: account.id,
    currency: probe.currency,
    accountName: probe.name,
  };
}

export async function disconnectMetaAds(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not authorized",
    };
  }

  const accountId = formData.get("accountId")?.toString();
  if (!accountId) return { ok: false, error: "accountId is required" };

  const account = await prisma.adAccount.findFirst({
    where: { id: accountId, orgId: scope.orgId, platform: AdPlatform.META },
    select: { id: true },
  });
  if (!account) return { ok: false, error: "Meta Ads account not found" };

  await prisma.adAccount.update({
    where: { id: account.id },
    data: {
      credentialsEncrypted: null,
      tokenEncrypted: null,
      refreshTokenEncrypted: null,
      accessStatus: "revoked",
      autoSyncEnabled: false,
    },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.SETTING_CHANGE,
      entityType: "AdAccount",
      entityId: account.id,
      description: "Meta Ads disconnected",
    }),
  });

  revalidatePath(PORTAL_INTEGRATIONS);
  revalidatePath(PORTAL_ADS);
  return { ok: true };
}

export async function triggerMetaAdsSync(
  accountId: string
): Promise<{ ok: true; campaigns: number; metrics: number } | { ok: false; error: string }> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not authorized",
    };
  }

  const account = await prisma.adAccount.findFirst({
    where: { id: accountId, orgId: scope.orgId, platform: AdPlatform.META },
    select: { id: true },
  });
  if (!account) return { ok: false, error: "Meta Ads account not found" };

  const result = await runAdsSyncForAccount(account.id, { fullBackfill: true });

  revalidatePath(PORTAL_INTEGRATIONS);
  revalidatePath(PORTAL_ADS);

  if (!result.ok) return { ok: false, error: result.error ?? "Sync failed" };
  return {
    ok: true,
    campaigns: result.stats.campaignsUpserted,
    metrics: result.stats.metricRowsUpserted,
  };
}
