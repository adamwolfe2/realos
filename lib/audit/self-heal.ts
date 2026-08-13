/**
 * Prospect-audit self-heal (2026-08-13).
 *
 * The start route triggers /api/audit/run/[id] fire-and-forget. That
 * trigger can drop (observed: livehigby.com audit stranded QUEUED for
 * 20+ minutes) and the old watchdog made it worse two ways:
 *   - it flipped stalled QUEUED rows to FAILED, even though a dropped
 *     trigger is retryable (nothing ran, nothing was spent), and
 *   - its 90s window was SHORTER than the run route's 120s maxDuration,
 *     so a poll at t+91s could fail a scan that was still working.
 *
 * New policy, applied from both poll surfaces (status API + viewer
 * PendingState render):
 *   - QUEUED older than 60s  → re-fire the run trigger. The run route's
 *     atomic claim makes duplicate triggers harmless.
 *   - RUNNING with no write for 150s (maxDuration + 30s headroom, on
 *     updatedAt not createdAt) → the function died mid-scan; flip to
 *     FAILED. Retrying a half-run scan re-spends the whole fan-out, so
 *     failure is the honest terminal state there.
 */

import "server-only";
import { prisma } from "@/lib/db";
import { ProspectAuditStatus } from "@prisma/client";
import { getSiteUrl } from "@/lib/brand";

const QUEUED_RETRIGGER_MS = 60_000;
// app/api/audit/run/[id]/route.ts maxDuration = 120s. Keep this ABOVE it.
const RUNNING_DEAD_MS = 150_000;

export type HealAction = "retrigger" | "fail" | null;

/** Pure decision — exported for tests. */
export function decideHeal(
  status: ProspectAuditStatus,
  createdAtMs: number,
  updatedAtMs: number,
  nowMs: number,
): HealAction {
  if (
    status === ProspectAuditStatus.QUEUED &&
    nowMs - createdAtMs > QUEUED_RETRIGGER_MS
  ) {
    return "retrigger";
  }
  if (
    status === ProspectAuditStatus.RUNNING &&
    nowMs - updatedAtMs > RUNNING_DEAD_MS
  ) {
    return "fail";
  }
  return null;
}

/** Fire-and-forget POST to the run route. Never throws. */
export function fireAuditRunTrigger(auditId: string): void {
  const cronSecret = process.env.CRON_SECRET ?? "";
  fetch(`${getSiteUrl()}/api/audit/run/${auditId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-trigger": cronSecret,
    },
  }).catch(() => undefined);
}

/**
 * Apply the heal policy to one audit row. Returns the action taken (the
 * status API uses "fail" to report FAILED on the same poll). Never throws.
 */
export async function healStalledProspectAudit(audit: {
  id: string;
  status: ProspectAuditStatus;
  createdAt: Date;
  updatedAt: Date;
}): Promise<HealAction> {
  const action = decideHeal(
    audit.status,
    audit.createdAt.getTime(),
    audit.updatedAt.getTime(),
    Date.now(),
  );
  if (action === "retrigger") {
    fireAuditRunTrigger(audit.id);
    return action;
  }
  if (action === "fail") {
    await prisma.prospectAudit
      .update({
        // Optimistic guard: only flip if still RUNNING.
        where: { id: audit.id, status: ProspectAuditStatus.RUNNING },
        data: {
          status: ProspectAuditStatus.FAILED,
          errorMessage:
            "Scan exceeded the function timeout. The pipeline likely took longer than maxDuration allows; bump it or trim the fan-out.",
        },
      })
      .catch(() => undefined);
    return action;
  }
  return null;
}
