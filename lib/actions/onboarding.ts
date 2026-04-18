"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";

// ---------------------------------------------------------------------------
// Onboarding checklist server actions.
//
// The first-login walkthrough on /portal surfaces a "Welcome to RealEstaite"
// card. Once the operator clicks "Hide this", we flip
// Organization.onboardingDismissed so it stays hidden on subsequent visits.
// The operator can always reopen it with ?showSetup=1.
// ---------------------------------------------------------------------------

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function dismissOnboarding(): Promise<ActionResult> {
  try {
    const scope = await requireScope();

    await prisma.organization.update({
      where: { id: scope.orgId },
      data: { onboardingDismissed: true },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.SETTING_CHANGE,
        entityType: "Organization",
        entityId: scope.orgId,
        description: "Onboarding checklist dismissed",
        diff: { onboardingDismissed: true } as Prisma.InputJsonValue,
      }),
    });

    revalidatePath("/portal");
    return { ok: true };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error("dismissOnboarding failed", err);
    return { ok: false, error: "Failed to dismiss onboarding checklist" };
  }
}
