"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditPayload, requireWorkspaceAdmin } from "@/lib/tenancy/scope";
import { runSeoSync } from "@/lib/integrations/seo-sync";
import { loadPendingSeoOptions } from "@/lib/integrations/google-properties";
import { AuditAction, SeoSyncStatus } from "@prisma/client";

// Step 2 of the GA4 / Search Console "Sign in with Google" flow: bind the
// property the operator picked to the pending SeoIntegration row the OAuth
// callback created. The identifier must be one Google listed for this
// login; the client value is never trusted on its own.

const schema = z.object({
  provider: z.enum(["GA4", "GSC"]),
  propertyIdentifier: z.string().trim().min(1).max(300),
});

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
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not authorized",
    };
  }

  const parsed = schema.safeParse({
    provider: formData.get("provider")?.toString() ?? "",
    propertyIdentifier: formData.get("propertyIdentifier")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Pick a property to connect." };
  }
  const { provider, propertyIdentifier } = parsed.data;

  let pending;
  try {
    pending = await loadPendingSeoOptions(scope.orgId, provider);
  } catch (err) {
    console.error("[seo-oauth-bind] listing Google properties failed", err);
    return {
      ok: false,
      error: "Couldn't reach Google to confirm that property. Try again.",
    };
  }
  if (!pending.row) {
    return {
      ok: false,
      error: "This sign-in expired. Start again from Connect.",
    };
  }
  const choice = pending.options.find((o) => o.id === propertyIdentifier);
  if (!choice) {
    return {
      ok: false,
      error: "That property isn't available to the Google account you used.",
    };
  }

  await prisma.seoIntegration.update({
    where: { id: pending.row.id },
    data: { propertyIdentifier: choice.id, status: SeoSyncStatus.IDLE },
  });

  await prisma.auditEvent.create({
    data: auditPayload(scope, {
      action: AuditAction.SETTING_CHANGE,
      entityType: "SeoIntegration",
      entityId: pending.row.id,
      description: `${provider} connected via Google sign-in (${choice.name})`,
    }),
  });

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
