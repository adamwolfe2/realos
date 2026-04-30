"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAgency, ForbiddenError } from "@/lib/tenancy/scope";
import {
  runAppfolioSync,
  type AppfolioSyncStats,
} from "@/lib/integrations/appfolio-sync";

// Admin-scoped AppFolio operations. requireAgency gates these to LeaseStack
// staff so we can force a sync, mark a property attachable, or clear a stuck
// "syncing" status from the diagnosis page. Audit rows are written against
// the *affected tenant* with the agency actor as userId so the chain of
// custody survives impersonation.

export type AdminSyncResult =
  | { ok: true; orgId: string; stats: AppfolioSyncStats }
  | { ok: false; orgId: string; error: string; stats?: AppfolioSyncStats };

async function logAdminEvent(args: {
  agencyUserId: string | null | undefined;
  affectedOrgId: string;
  description: string;
  diff?: Prisma.InputJsonValue;
  entityId?: string;
}): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      orgId: args.affectedOrgId,
      userId: args.agencyUserId ?? null,
      action: AuditAction.SETTING_CHANGE,
      entityType: "AppFolioIntegration",
      entityId: args.entityId ?? null,
      description: args.description,
      diff: args.diff ?? Prisma.JsonNull,
    },
  });
}

export async function adminRunAppfolioSync(
  orgId: string
): Promise<AdminSyncResult> {
  try {
    const agency = await requireAgency();
    if (!orgId) return { ok: false, orgId: "", error: "orgId required" };

    const result = await runAppfolioSync(orgId);

    await logAdminEvent({
      agencyUserId: agency.userId,
      affectedOrgId: orgId,
      description: result.ok
        ? "AppFolio sync triggered by agency staff"
        : `AppFolio sync triggered by agency staff (failed: ${result.error})`,
      diff: { stats: result.stats } as Prisma.InputJsonValue,
    });

    revalidatePath("/admin/integrations/appfolio");
    revalidatePath(`/admin/clients/${orgId}`);

    if (!result.ok) {
      return {
        ok: false,
        orgId,
        error: result.error ?? "Sync failed",
        stats: result.stats,
      };
    }
    return { ok: true, orgId, stats: result.stats };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, orgId, error: err.message };
    }
    console.error("adminRunAppfolioSync failed", err);
    return { ok: false, orgId, error: "Failed to run sync" };
  }
}

export async function adminClearStuckSyncStatus(
  orgId: string
): Promise<AdminSyncResult> {
  try {
    const agency = await requireAgency();

    const integration = await prisma.appFolioIntegration.findUnique({
      where: { orgId },
      select: { id: true, syncStatus: true },
    });
    if (!integration) {
      return { ok: false, orgId, error: "Integration not found" };
    }

    await prisma.appFolioIntegration.update({
      where: { orgId },
      data: { syncStatus: "idle" },
    });

    await logAdminEvent({
      agencyUserId: agency.userId,
      affectedOrgId: orgId,
      entityId: integration.id,
      description: `Cleared stuck sync status (was: ${integration.syncStatus ?? "null"})`,
    });

    revalidatePath("/admin/integrations/appfolio");
    revalidatePath(`/admin/clients/${orgId}`);

    return {
      ok: true,
      orgId,
      stats: {
        leadsUpserted: 0,
        toursUpserted: 0,
        tenantsMatched: 0,
        listingsUpserted: 0,
        propertiesUpserted: 0,
        residentsUpserted: 0,
        leasesUpserted: 0,
        workOrdersUpserted: 0,
        delinquenciesUpdated: 0,
        warnings: [] as string[],
      },
    };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, orgId, error: err.message };
    }
    console.error("adminClearStuckSyncStatus failed", err);
    return { ok: false, orgId, error: "Failed to clear status" };
  }
}

export async function adminMarkPropertiesAppfolio(
  orgId: string
): Promise<AdminSyncResult> {
  // Most common silent failure: tenant has Property rows but their
  // backendPlatform is NONE, so the sync's listing loop drops every row with
  // "no Property to attach". This action flips them to APPFOLIO so the next
  // sync can attach.
  try {
    const agency = await requireAgency();

    const result = await prisma.property.updateMany({
      where: { orgId, backendPlatform: "NONE" },
      data: { backendPlatform: "APPFOLIO" },
    });

    await logAdminEvent({
      agencyUserId: agency.userId,
      affectedOrgId: orgId,
      description: `Flipped ${result.count} property(ies) to backendPlatform=APPFOLIO`,
    });

    revalidatePath("/admin/integrations/appfolio");
    revalidatePath(`/admin/clients/${orgId}`);

    return {
      ok: true,
      orgId,
      stats: {
        leadsUpserted: 0,
        toursUpserted: 0,
        tenantsMatched: 0,
        listingsUpserted: 0,
        propertiesUpserted: 0,
        residentsUpserted: 0,
        leasesUpserted: 0,
        workOrdersUpserted: 0,
        delinquenciesUpdated: 0,
        warnings: [`updated ${result.count} property rows`],
      },
    };
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, orgId, error: err.message };
    }
    console.error("adminMarkPropertiesAppfolio failed", err);
    return { ok: false, orgId, error: "Failed to update properties" };
  }
}
