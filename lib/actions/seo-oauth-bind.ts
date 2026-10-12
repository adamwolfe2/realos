"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  auditPayload,
  ForbiddenError,
  requireWorkspaceAdmin,
} from "@/lib/tenancy/scope";
import { runSeoSync } from "@/lib/integrations/seo-sync";
import {
  loadPendingSeoOptions,
  PENDING_OAUTH_BIND,
} from "@/lib/integrations/google-properties";
import { AuditAction, SeoSyncStatus } from "@prisma/client";

// Step 2 of the GA4 / Search Console "Sign in with Google" flow: bind the
// property the operator picked to the pending SeoIntegration row the OAuth
// callback created. The identifier must be one Google listed for this
// login; the client value is never trusted on its own.

const schema = z.object({
  provider: z.enum(["GA4", "GSC"]),
  propertyIdentifier: z.string().trim().min(1).max(300),
  // LeaseStack property the sign-in was scoped to (signed OAuth state ->
  // callback redirect -> picker). Empty = the org-wide row. Only ever
  // matched against this org's own pending rows.
  propertyId: z
    .string()
    .trim()
    .max(64)
    .transform((v) => v || null),
});

const EXPIRED = "This sign-in expired. Start again from Connect.";

export type BindSeoPropertyResult =
  | { ok: true; label: string }
  | { ok: false; error: string };

export async function bindSeoProperty(
  formData: FormData,
): Promise<BindSeoPropertyResult> {
  let scope;
  try {
    scope = await requireWorkspaceAdmin();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = schema.safeParse({
    provider: formData.get("provider")?.toString() ?? "",
    propertyIdentifier: formData.get("propertyIdentifier")?.toString() ?? "",
    propertyId: formData.get("propertyId")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Pick a property to connect." };
  }
  const { provider, propertyIdentifier, propertyId } = parsed.data;

  let pending;
  try {
    pending = await loadPendingSeoOptions(scope, provider, propertyId);
  } catch (err) {
    console.error("[seo-oauth-bind] listing Google properties failed", err);
    return {
      ok: false,
      error: "Couldn't reach Google to confirm that property. Try again.",
    };
  }
  if (!pending.row) return { ok: false, error: EXPIRED };
  const choice = pending.options.find((o) => o.id === propertyIdentifier);
  if (!choice) {
    return {
      ok: false,
      error: "That property isn't available to the Google account you used.",
    };
  }

  try {
    // Conditional on the row still being pending: two tabs/admins can both
    // pass the checks above, and only the first submission may bind.
    const bound = await prisma.seoIntegration.updateMany({
      where: {
        id: pending.row.id,
        orgId: scope.orgId,
        propertyIdentifier: PENDING_OAUTH_BIND,
      },
      data: { propertyIdentifier: choice.id, status: SeoSyncStatus.IDLE },
    });
    if (bound.count === 0) return { ok: false, error: EXPIRED };

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.SETTING_CHANGE,
        entityType: "SeoIntegration",
        entityId: pending.row.id,
        description: `${provider} connected via Google sign-in (${choice.name})`,
      }),
    });
  } catch (err) {
    console.error("[seo-oauth-bind] saving the property failed", err);
    return {
      ok: false,
      error: "Couldn't save that property. Try again.",
    };
  }

  void runSeoSync(scope.orgId, { fullBackfill: true }).catch((err) => {
    console.warn("[seo-oauth-bind] initial sync error", err);
  });
  const { syncOnboardingProgressInBackground } = await import(
    "@/lib/onboarding/step-detectors"
  );
  syncOnboardingProgressInBackground(scope.orgId);

  revalidatePath("/portal/settings/integrations");
  revalidatePath("/portal/connect");
  revalidatePath("/portal/seo");
  return { ok: true, label: choice.name };
}
