"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireScope, auditPayload } from "@/lib/tenancy/scope";
import { encrypt } from "@/lib/crypto";
import {
  normalizeCustomerId,
  testGoogleAdsConnection,
  type GoogleAdsCredentials,
} from "@/lib/integrations/google-ads";
import { runAdsSyncForAccount } from "@/lib/integrations/ads-sync";
import { AdPlatform, AuditAction } from "@prisma/client";

// ---------------------------------------------------------------------------
// Google Ads connect / disconnect / sync server actions.
//
// V1 auth (no OAuth): the operator pastes:
//   - developer token         (issued to the agency MCC by Google Ads)
//   - login customer ID       (manager account ID; optional but usually needed)
//   - client customer ID      (the actual ad account they want metrics from)
//   - oauth client id/secret  (from the same Google Cloud project)
//   - refresh token           (generated once via OAuth Playground for the
//                              same client_id, with scope adwords)
//
// We test the credentials against the customer endpoint before persisting.
// ---------------------------------------------------------------------------

const PORTAL_INTEGRATIONS = "/portal/settings/integrations";
const PORTAL_ADS = "/portal/ads";

const connectSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  clientCustomerId: z
    .string()
    .trim()
    .min(8, "Client customer ID is required")
    .max(32)
    .transform((v) => normalizeCustomerId(v))
    .refine((v) => v.length >= 8, {
      message: "Customer ID should be the 10-digit number from Google Ads (no dashes)",
    }),
  oauthClientId: z.string().trim().min(8, "OAuth client ID is required").max(512),
  oauthClientSecret: z.string().trim().min(8, "OAuth client secret is required").max(512),
  refreshToken: z.string().trim().min(8, "Refresh token is required").max(2048),
});

export type ConnectGoogleAdsResult =
  | { ok: true; accountId: string; currency: string | null }
  | { ok: false; error: string };

export async function connectGoogleAds(
  formData: FormData
): Promise<ConnectGoogleAdsResult> {
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
    clientCustomerId: formData.get("clientCustomerId")?.toString() ?? "",
    oauthClientId: formData.get("oauthClientId")?.toString() ?? "",
    oauthClientSecret: formData.get("oauthClientSecret")?.toString() ?? "",
    refreshToken: formData.get("refreshToken")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const creds: GoogleAdsCredentials = {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? null,
    refreshToken: parsed.data.refreshToken,
    oauthClientId: parsed.data.oauthClientId,
    oauthClientSecret: parsed.data.oauthClientSecret,
  };

  const probe = await testGoogleAdsConnection(creds, parsed.data.clientCustomerId);
  if (!probe.ok) {
    return {
      ok: false,
      error: `Google Ads rejected the credentials: ${probe.error}`,
    };
  }

  const credentialsEncrypted = encrypt(JSON.stringify(creds));

  const existing = await prisma.adAccount.findUnique({
    where: {
      orgId_platform_externalAccountId: {
        orgId: scope.orgId,
        platform: AdPlatform.GOOGLE_ADS,
        externalAccountId: parsed.data.clientCustomerId,
      },
    },
    select: { id: true },
  });

  const account = await prisma.adAccount.upsert({
    where: {
      orgId_platform_externalAccountId: {
        orgId: scope.orgId,
        platform: AdPlatform.GOOGLE_ADS,
        externalAccountId: parsed.data.clientCustomerId,
      },
    },
    create: {
      orgId: scope.orgId,
      platform: AdPlatform.GOOGLE_ADS,
      externalAccountId: parsed.data.clientCustomerId,
      displayName: parsed.data.displayName ?? "Google Ads",
      currency: probe.currency ?? "USD",
      credentialsEncrypted,
      accessStatus: "active",
      autoSyncEnabled: true,
    },
    update: {
      displayName: parsed.data.displayName ?? "Google Ads",
      currency: probe.currency ?? "USD",
      credentialsEncrypted,
      accessStatus: "active",
      autoSyncEnabled: true,
      lastSyncError: null,
    },
  });

  await prisma.organization.update({
    where: { id: scope.orgId },
    data: { moduleGoogleAds: true },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.SETTING_CHANGE,
      entityType: "AdAccount",
      entityId: account.id,
      description: existing ? "Google Ads reconnected" : "Google Ads connected",
    }),
  });

  // Fire-and-forget initial 30-day backfill.
  void runAdsSyncForAccount(account.id, { fullBackfill: true }).catch((err) => {
    console.warn("[google-ads-connect] initial sync error", err);
  });

  revalidatePath(PORTAL_INTEGRATIONS);
  revalidatePath(PORTAL_ADS);
  return { ok: true, accountId: account.id, currency: probe.currency };
}

export async function disconnectGoogleAds(
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
    where: { id: accountId, orgId: scope.orgId, platform: AdPlatform.GOOGLE_ADS },
    select: { id: true },
  });
  if (!account) return { ok: false, error: "Google Ads account not found" };

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
      description: "Google Ads disconnected",
    }),
  });

  revalidatePath(PORTAL_INTEGRATIONS);
  revalidatePath(PORTAL_ADS);
  return { ok: true };
}

export async function triggerGoogleAdsSync(
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
    where: { id: accountId, orgId: scope.orgId, platform: AdPlatform.GOOGLE_ADS },
    select: { id: true },
  });
  if (!account) return { ok: false, error: "Google Ads account not found" };

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
