"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireScope, auditPayload } from "@/lib/tenancy/scope";
import { normalizeCustomerId } from "@/lib/integrations/google-ads";
import { runAdsSyncForAccount } from "@/lib/integrations/ads-sync";
import { AdPlatform, AuditAction, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// bindGoogleAdsCustomer
//
// Picker action. Called from /portal/connect/google-ads/select once the
// operator chooses which Google Ads customer ID to bind to their LeaseStack
// org. Updates two rows in one transaction:
//
//   1. OAuthConnection (orgId, provider=google_ads, externalAccountId=null)
//      → set externalAccountId = chosen customer ID
//      → stash loginCustomerId (the MCC, if the picked customer is under one)
//        into metadata so sync can scope its queries correctly
//
//   2. AdAccount (orgId, platform=GOOGLE_ADS, externalAccountId=chosen ID)
//      → upsert so the row exists for the dashboard and sync. The OAuth
//        path leaves `credentialsEncrypted` NULL (sync now resolves via
//        OAuthConnection via resolveGoogleAdsCredentials). accessStatus
//        starts "active"; a background backfill fires immediately.
//
// Then kicks off a fire-and-forget 30-day backfill sync.
// ---------------------------------------------------------------------------

const PORTAL_INTEGRATIONS = "/portal/settings/integrations";
const PORTAL_ADS = "/portal/ads";
const PORTAL_CONNECT_SELECT = "/portal/connect/google-ads/select";

const schema = z.object({
  customerId: z
    .string()
    .trim()
    .min(8, "Customer ID is required")
    .max(32)
    .transform((v) => normalizeCustomerId(v))
    .refine((v) => v.length >= 8 && v.length <= 12, {
      message: "Customer ID should be the 10-digit number from Google Ads.",
    }),
  // Optional — set only when the chosen customer is under a manager (MCC).
  // Comes from listAccessibleCustomers' AccessibleCustomer.loginCustomerId.
  loginCustomerId: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((v) => (v ? normalizeCustomerId(v) : null)),
  displayName: z.string().trim().min(1).max(120).optional(),
  currencyCode: z.string().trim().length(3).optional(),
});

export type BindGoogleAdsResult =
  | { ok: true; adAccountId: string }
  | { ok: false; error: string };

export async function bindGoogleAdsCustomer(
  formData: FormData
): Promise<BindGoogleAdsResult> {
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
    customerId: formData.get("customerId")?.toString() ?? "",
    loginCustomerId: formData.get("loginCustomerId")?.toString() || undefined,
    displayName: formData.get("displayName")?.toString() || undefined,
    currencyCode: formData.get("currencyCode")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { customerId, loginCustomerId, displayName, currencyCode } = parsed.data;

  // 1. Find the org's unbound OAuth row (externalAccountId=null) and
  //    promote it to point at the chosen customer. If a row already exists
  //    for (orgId, google_ads, customerId), the operator is re-binding —
  //    we overwrite the unbound row's externalAccountId with the chosen
  //    value (and drop the duplicate later if any).
  const unbound = await prisma.oAuthConnection.findFirst({
    where: {
      orgId: scope.orgId,
      provider: "google_ads",
      externalAccountId: null,
      status: "active",
    },
    select: { id: true, metadata: true },
  });
  if (!unbound) {
    return {
      ok: false,
      error:
        "No active Google Ads OAuth connection on file — re-connect via the Connect button.",
    };
  }

  const metadataPayload: Prisma.InputJsonValue = {
    ...((unbound.metadata as Record<string, unknown> | null) ?? {}),
    loginCustomerId: loginCustomerId ?? null,
    boundAt: new Date().toISOString(),
  };

  // 2. Upsert AdAccount row keyed on (orgId, platform, externalAccountId).
  const adAccount = await prisma.adAccount.upsert({
    where: {
      orgId_platform_externalAccountId: {
        orgId: scope.orgId,
        platform: AdPlatform.GOOGLE_ADS,
        externalAccountId: customerId,
      },
    },
    create: {
      orgId: scope.orgId,
      platform: AdPlatform.GOOGLE_ADS,
      externalAccountId: customerId,
      displayName: displayName ?? "Google Ads",
      currency: currencyCode ?? "USD",
      accessStatus: "active",
      autoSyncEnabled: true,
      // credentialsEncrypted intentionally NULL — sync resolves via
      // OAuthConnection via resolveGoogleAdsCredentials. The legacy paste
      // path is what writes credentialsEncrypted; the two paths are
      // mutually exclusive per AdAccount row.
    },
    update: {
      displayName: displayName ?? "Google Ads",
      currency: currencyCode ?? "USD",
      accessStatus: "active",
      autoSyncEnabled: true,
      lastSyncError: null,
    },
  });

  // 3. Update the OAuthConnection row to point at the chosen customer.
  //    Do this AFTER the AdAccount upsert so a partial failure leaves
  //    the unbound row still findable for a retry.
  await prisma.oAuthConnection.update({
    where: { id: unbound.id },
    data: {
      externalAccountId: customerId,
      metadata: metadataPayload,
      status: "active",
    },
  });

  // 4. Flip org-level module gate so the Ads nav surfaces and dashboards
  //    light up. Matches the legacy connectGoogleAds() server action.
  await prisma.organization.update({
    where: { id: scope.orgId },
    data: { moduleGoogleAds: true },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.SETTING_CHANGE,
      entityType: "AdAccount",
      entityId: adAccount.id,
      description: `Google Ads bound to customer ${customerId}${loginCustomerId ? ` (via MCC ${loginCustomerId})` : ""}`,
    }),
  });

  // 5. Fire-and-forget initial 30-day backfill. The operator lands on
  //    /portal/ads moments later — if the backfill returns quickly, real
  //    metrics are already on screen; if not, they appear at the next
  //    cron tick. Either way the user sees the new account in the list.
  void runAdsSyncForAccount(adAccount.id, { fullBackfill: true }).catch((err) => {
    console.warn("[bindGoogleAdsCustomer] initial sync error", err);
  });

  revalidatePath(PORTAL_INTEGRATIONS);
  revalidatePath(PORTAL_ADS);
  revalidatePath(PORTAL_CONNECT_SELECT);
  return { ok: true, adAccountId: adAccount.id };
}
