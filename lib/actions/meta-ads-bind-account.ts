"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireScope, auditPayload } from "@/lib/tenancy/scope";
import { runAdsSyncForAccount } from "@/lib/integrations/ads-sync";
import { AdPlatform, AuditAction, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// bindMetaAdsAccount
//
// Meta equivalent of bindGoogleAdsCustomer. Called from
// /portal/connect/meta-ads/select after the operator picks one of the Meta
// ad accounts their OAuth token can reach. Promotes the unbound
// OAuthConnection row to point at the chosen ad account ID and upserts a
// matching AdAccount row for the dashboard.
// ---------------------------------------------------------------------------

const PORTAL_INTEGRATIONS = "/portal/settings/integrations";
const PORTAL_ADS = "/portal/ads";
const PORTAL_CONNECT_SELECT = "/portal/connect/meta-ads/select";

const schema = z.object({
  externalAccountId: z
    .string()
    .trim()
    .min(1, "Meta ad account ID is required")
    .max(32)
    .transform((v) => v.replace(/^act_/, "").replace(/[^0-9]/g, "")),
  displayName: z.string().trim().min(1).max(160).optional(),
  currencyCode: z.string().trim().length(3).optional(),
});

export type BindMetaAdsResult =
  | { ok: true; adAccountId: string }
  | { ok: false; error: string };

export async function bindMetaAdsAccount(
  formData: FormData,
): Promise<BindMetaAdsResult> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not authorized",
    };
  }

  const parsed = schema.safeParse({
    externalAccountId: formData.get("externalAccountId")?.toString() ?? "",
    displayName: formData.get("displayName")?.toString() || undefined,
    currencyCode: formData.get("currencyCode")?.toString() || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { externalAccountId, displayName, currencyCode } = parsed.data;

  const unbound = await prisma.oAuthConnection.findFirst({
    where: {
      orgId: scope.orgId,
      provider: "meta_ads",
      externalAccountId: null,
      status: "active",
    },
    select: { id: true, metadata: true },
  });
  if (!unbound) {
    return {
      ok: false,
      error:
        "No active Meta Ads OAuth connection on file — re-connect via the Connect button.",
    };
  }

  const metadataPayload: Prisma.InputJsonValue = {
    ...((unbound.metadata as Record<string, unknown> | null) ?? {}),
    boundAt: new Date().toISOString(),
  };

  const adAccount = await prisma.adAccount.upsert({
    where: {
      orgId_platform_externalAccountId: {
        orgId: scope.orgId,
        platform: AdPlatform.META,
        externalAccountId,
      },
    },
    create: {
      orgId: scope.orgId,
      platform: AdPlatform.META,
      externalAccountId,
      displayName: displayName ?? "Meta Ads",
      currency: currencyCode ?? "USD",
      accessStatus: "active",
      autoSyncEnabled: true,
    },
    update: {
      displayName: displayName ?? "Meta Ads",
      currency: currencyCode ?? "USD",
      accessStatus: "active",
      autoSyncEnabled: true,
      lastSyncError: null,
    },
  });

  await prisma.oAuthConnection.update({
    where: { id: unbound.id },
    data: {
      externalAccountId,
      metadata: metadataPayload,
      status: "active",
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
      entityId: adAccount.id,
      description: `Meta Ads bound to account ${externalAccountId}`,
    }),
  });

  void runAdsSyncForAccount(adAccount.id, { fullBackfill: true }).catch(
    (err) => {
      console.warn("[bindMetaAdsAccount] initial sync error", err);
    },
  );

  revalidatePath(PORTAL_INTEGRATIONS);
  revalidatePath(PORTAL_ADS);
  revalidatePath(PORTAL_CONNECT_SELECT);
  return { ok: true, adAccountId: adAccount.id };
}
