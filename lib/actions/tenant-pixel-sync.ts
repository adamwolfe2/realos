"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireScope, auditPayload } from "@/lib/tenancy/scope";
import { AuditAction } from "@prisma/client";
import { runCursiveSegmentSync } from "./admin-cursive";

// ---------------------------------------------------------------------------
// Tenant-scoped pixel sync.
//
// Operators on the /portal/visitors page can pull the latest identified
// visitors from AudienceLab on demand, and the page auto-triggers a sync
// when data is stale (>15 min since lastEventAt). Mirrors the agency
// "Sync from segment" action but limited to the caller's own org via
// requireScope.
//
// Returns a stable shape so the client can render success / failure
// consistently. Rate-limited soft-cap of one sync per minute per org —
// further calls within that window short-circuit with the cached state
// instead of re-hammering AL.
// ---------------------------------------------------------------------------

const MIN_SYNC_INTERVAL_MS = 60_000; // 1 minute

export type TenantPixelSyncResult =
  | { ok: true; pulled: number; created: number; updated: number; throttled?: boolean }
  | { ok: false; error: string };

export async function syncPixelFromSegment(): Promise<TenantPixelSyncResult> {
  const scope = await requireScope();

  // Throttle: if we synced very recently, return the existing state
  // without burning another AL round-trip. The page-load auto-trigger
  // would otherwise re-fetch every render.
  const integration = await prisma.cursiveIntegration.findUnique({
    where: { orgId: scope.orgId },
    select: {
      lastSegmentSyncAt: true,
      cursiveSegmentId: true,
      cursivePixelId: true,
    },
  });
  if (!integration) {
    return {
      ok: false,
      error:
        "No AudienceLab pixel configured for this workspace. Contact your agency to provision one.",
    };
  }
  if (!integration.cursiveSegmentId) {
    return {
      ok: false,
      error:
        "AudienceLab segment is not bound to this workspace yet. Ask your agency to bind one in the admin panel.",
    };
  }

  const now = Date.now();
  if (
    integration.lastSegmentSyncAt &&
    now - integration.lastSegmentSyncAt.getTime() < MIN_SYNC_INTERVAL_MS
  ) {
    return { ok: true, pulled: 0, created: 0, updated: 0, throttled: true };
  }

  const result = await runCursiveSegmentSync(scope.orgId);
  if (!result.ok) return result;

  // Audit so operators can see who pulled when.
  await prisma.auditEvent
    .create({
      data: auditPayload(scope, {
        action: AuditAction.SETTING_CHANGE,
        entityType: "CursiveIntegration",
        entityId: scope.orgId,
        description: `Operator pulled ${result.pulled} visitors from AudienceLab segment`,
        diff: {
          pulled: result.pulled,
          created: result.created,
          updated: result.updated,
        },
      }),
    })
    .catch(() => undefined);

  revalidatePath("/portal/visitors");
  return result;
}
