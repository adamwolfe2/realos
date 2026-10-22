// Ends leases that dropped off AppFolio's rent roll (move-outs).
//
// INVARIANT: a lease is set ENDED here only when ALL of these hold:
//   1. the rent_roll pull completed: rows > 0, every row mapped, not
//      truncated at MAX_PAGES, and the phase threw no error;
//   2. the lease's property appeared in that pull (a property missing from
//      the report entirely is never swept);
//   3. the lease is ACTIVE or EXPIRING, its endDate is set and in the past;
//   4. its externalId is absent from the pull.
// A partial, failed or empty pull must never end a lease. Leases absent
// from the roll with a FUTURE endDate (early move-outs, transfers) are left
// alone: no evidence beyond absence, so they wait for their end date.
import { LeaseStatus } from "@prisma/client";

const OPEN_STATUSES: LeaseStatus[] = [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING];
const CHUNK = 1000;

export function rentRollIsComplete(pull: {
  rowCount: number;
  unmappedRows: number;
  truncated: boolean;
}): boolean {
  return pull.rowCount > 0 && pull.unmappedRows === 0 && !pull.truncated;
}

type LeaseSweepDb = {
  resident: {
    updateMany(args: {
      where: Record<string, unknown>;
      data: { currentLeaseId: null };
    }): Promise<{ count: number }>;
  };
  lease: {
    findMany(args: {
      where: Record<string, unknown>;
      select: { id: true; externalId: true };
    }): Promise<Array<{ id: string; externalId: string | null }>>;
    updateMany(args: {
      where: Record<string, unknown>;
      data: { status: LeaseStatus };
    }): Promise<{ count: number }>;
  };
};

export async function endLeasesAbsentFromRentRoll(
  db: LeaseSweepDb,
  args: {
    orgId: string;
    propertyIds: string[];
    seenExternalIds: ReadonlySet<string>;
    now: Date;
  },
): Promise<number> {
  if (args.propertyIds.length === 0) return 0;
  const candidates = await db.lease.findMany({
    where: {
      orgId: args.orgId,
      externalSystem: "appfolio",
      propertyId: { in: args.propertyIds },
      status: { in: OPEN_STATUSES },
      endDate: { lt: args.now },
    },
    select: { id: true, externalId: true },
  });
  const ids = candidates
    .filter((l) => l.externalId && !args.seenExternalIds.has(l.externalId))
    .map((l) => l.id);
  let ended = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const res = await db.lease.updateMany({
      // Re-check status and endDate so a concurrent writer's newer state
      // (a renewal) isn't clobbered.
      where: {
        id: { in: ids.slice(i, i + CHUNK) },
        status: { in: OPEN_STATUSES },
        endDate: { lt: args.now },
      },
      data: { status: LeaseStatus.ENDED },
    });
    ended += res.count;
    // An ended lease is no longer anyone's current lease.
    await db.resident.updateMany({
      where: {
        currentLeaseId: { in: ids.slice(i, i + CHUNK) },
        currentLease: { status: LeaseStatus.ENDED },
      },
      data: { currentLeaseId: null },
    });
  }
  return ended;
}
