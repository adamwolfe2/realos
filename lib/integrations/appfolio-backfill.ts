import { prisma } from "@/lib/db";
import { captureWithContext } from "@/lib/sentry";

// Deliberately its own module rather than living in appfolio-sync.ts:
// the lifecycle server actions only need to stamp a column, and importing
// the 2,000-line sync worker (plus its REST client and every payload
// mapper) into that bundle just to reach a one-line updateMany is a lot of
// weight for nothing.

/**
 * Arm a full-window backfill on the next AppFolio sync for these orgs.
 *
 * Call this whenever a Property is promoted to lifecycle=ACTIVE.
 *
 * Why it is needed: the sync declines to import child records — leads,
 * applications, residents, leases, listings, work orders — for any property
 * that is not ACTIVE (see isInactiveAppfolioProperty). That is the fix for
 * the AppFolio over-sync, but it has a corollary: the records skipped while
 * a building sat IMPORTED are not re-offered later. The incremental window
 * is `since lastSyncAt`, which has already advanced past them. So enabling
 * a building would leave it permanently, silently empty.
 *
 * Stamping this column makes the next run widen to the full backfill
 * window instead. runAppfolioSync clears it after a run that actually
 * completed a phase.
 *
 * Orgs with no AppFolio integration row simply match nothing — the
 * updateMany is a no-op, so callers do not need to pre-check.
 *
 * Non-throwing by design: the lifecycle change is the operator's actual
 * request and has already committed by the time this runs. A failure here
 * must not report the activation as failed. It is logged and captured, not
 * swallowed — a silently-dropped backfill is exactly the invisible failure
 * this whole slice exists to kill.
 */
export async function requestAppfolioBackfill(
  orgIds: readonly string[],
): Promise<void> {
  const unique = Array.from(new Set(orgIds.filter(Boolean)));
  if (unique.length === 0) return;

  try {
    await prisma.appFolioIntegration.updateMany({
      where: { orgId: { in: unique } },
      data: { backfillRequestedAt: new Date() },
    });
  } catch (err) {
    console.error(
      "[appfolio-backfill] failed to arm backfill for orgs",
      unique,
      err,
    );
    captureWithContext(err, {
      handler: "requestAppfolioBackfill",
      orgIds: unique.join(","),
    });
  }
}
