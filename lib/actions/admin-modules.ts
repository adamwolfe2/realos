"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAgency, ForbiddenError, auditPayload } from "@/lib/tenancy/scope";
import { AuditAction } from "@prisma/client";

// ---------------------------------------------------------------------------
// Agency-only module toggles. Renders the Modules card on the client detail
// page interactive — operator features (Website, Pixel, Chatbot, Google Ads,
// Meta Ads, SEO, Email, etc) flip on/off here.
//
// Audit-logged so the platform record reflects who turned what on for which
// tenant and when.
// ---------------------------------------------------------------------------

const TOGGLEABLE_MODULES = [
  "moduleWebsite",
  "modulePixel",
  "moduleChatbot",
  "moduleGoogleAds",
  "moduleMetaAds",
  "moduleSEO",
  "moduleEmail",
  "moduleOutboundEmail",
  "moduleReferrals",
  "moduleCreativeStudio",
  "moduleLeadCapture",
] as const;

export type ToggleableModule = (typeof TOGGLEABLE_MODULES)[number];

const inputSchema = z.object({
  orgId: z.string().min(1),
  module: z.enum(TOGGLEABLE_MODULES),
  enabled: z.boolean(),
});

export type ToggleResult =
  | { ok: true; module: ToggleableModule; enabled: boolean }
  | { ok: false; error: string };

export async function toggleClientModule(
  raw: unknown,
): Promise<ToggleResult> {
  let scope;
  try {
    scope = await requireAgency();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { orgId, module, enabled } = parsed.data;

  const target = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, [module]: true } as Record<string, true>,
  });
  if (!target) return { ok: false, error: "Tenant not found" };

  const previous = (target as Record<string, unknown>)[module] as boolean;
  if (previous === enabled) {
    return { ok: true, module, enabled };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { [module]: enabled },
  });

  await prisma.auditEvent.create({
    data: auditPayload(
      { ...scope, orgId },
      {
        action: AuditAction.SETTING_CHANGE,
        entityType: "Organization",
        entityId: orgId,
        description: `Module ${module} ${enabled ? "enabled" : "disabled"} by ${scope.email}`,
        diff: { module, from: previous, to: enabled },
      },
    ),
  });

  revalidatePath(`/admin/clients/${orgId}`);
  return { ok: true, module, enabled };
}
