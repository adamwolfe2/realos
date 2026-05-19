"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireWritableWorkspace } from "@/lib/tenancy/scope";
import { getAdRetentionPolicy } from "@/lib/billing/retention";

// Server action for the /portal/ads retention panel.
//
// Only callable on Scale / Enterprise (CUSTOM) tiers — the policy resolver
// ignores overrides on Foundation + Growth so allowing the write would be
// silently lossy. The mutation is gated AGAIN at the DB read so this can't
// be bypassed by a hand-crafted form post.
//
// Role gate: CLIENT_OWNER / CLIENT_ADMIN on the org, or any AGENCY_* user
// (impersonation already collapses scope.orgId to the client's id).
const WRITE_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.AGENCY_OWNER,
  UserRole.AGENCY_ADMIN,
  UserRole.AGENCY_OPERATOR,
  UserRole.CLIENT_OWNER,
  UserRole.CLIENT_ADMIN,
]);

export async function setAdRetentionOverride(months: number | null) {
  try {
    const scope = await requireWritableWorkspace();
    if (!WRITE_ROLES.has(scope.role)) {
      return { error: "You don't have permission to change retention." };
    }

    const org = await prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: {
        subscriptionTier: true,
        adDataRetentionMonths: true,
      },
    });
    if (!org) return { error: "Workspace not found." };

    const policy = getAdRetentionPolicy({
      tier: org.subscriptionTier,
      adDataRetentionMonths: org.adDataRetentionMonths,
    });
    if (policy.tier !== "scale" && policy.tier !== "enterprise") {
      return {
        error:
          "Custom retention windows are available on Scale and Enterprise tiers.",
      };
    }

    // Clamp to a sensible range. 1..120 months matches the resolver's
    // clamp so the UI and the store agree on what's valid.
    let next: number | null;
    if (months == null) {
      next = null;
    } else if (!Number.isFinite(months)) {
      return { error: "Invalid number of months." };
    } else {
      next = Math.max(1, Math.min(120, Math.floor(months)));
    }

    await prisma.organization.update({
      where: { id: scope.orgId },
      data: { adDataRetentionMonths: next },
    });

    revalidatePath("/portal/ads");
    return { success: true as const, months: next };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
