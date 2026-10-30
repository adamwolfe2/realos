// Ends leases that dropped off AppFolio's rent roll (move-outs).
//
// INVARIANT: a lease is set ENDED here only when ALL of these hold:
//   1. the rent_roll pull completed: rows > 0, every row mapped (vacant
//      unit rows aside, see isVacantUnitRow), not truncated at MAX_PAGES,
//      and the phase threw no error;
//   2. the lease's property appeared in that pull (a property missing from
//      the report entirely is never swept);
//   3. the lease is ACTIVE or EXPIRING, its endDate is set and in the past;
//   4. its externalId is absent from the pull.
// A partial, failed or empty pull must never end a lease. Leases absent
// from the roll with a FUTURE endDate (early move-outs, transfers) are left
// alone: no evidence beyond absence, so they wait for their end date.
import { LeaseStatus, ResidentStatus } from "@prisma/client";

const OPEN_STATUSES: LeaseStatus[] = [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING];
const CHUNK = 1000;

export function pullIsComplete(pull: {
  rowCount: number;
  unmappedRows: number;
  truncated: boolean;
}): boolean {
  return pull.rowCount > 0 && pull.unmappedRows === 0 && !pull.truncated;
}

// rent_roll lists every unit, so vacant units arrive as rows with no lease.
// Those are not failed mappings and must not block the sweep. Strict: a
// "Vacant" status AND no lease, occupancy or person id, so a malformed row
// that does carry a lease still counts as unmapped.
export function isVacantUnitRow(row: Record<string, unknown>): boolean {
  const status = typeof row.status === "string" ? row.status.trim().toLowerCase() : "";
  if (!status.startsWith("vacant")) return false;
  return !row.lease_id && !row.occupancy_id && !row.tenant_id && !row.occupant_id;
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

// Marks residents who dropped out of AppFolio's tenant_directory as PAST.
//
// INVARIANT (same shape as the lease sweep above): a resident is set PAST
// here only when ALL of these hold:
//   1. the tenant_directory pull completed (pullIsComplete) and threw no error;
//   2. the resident's property appeared in that pull;
//   3. the resident is ACTIVE or NOTICE_GIVEN, moveOutDate is set and past;
//   4. its externalId is absent from the pull.
// The directory returns only Current/Notice tenants, so a moved-out tenant
// simply disappears. Absent residents with no or a future move-out date are
// left alone: absence alone is not evidence. EVICTED / APPLICANT untouched.
const OPEN_RESIDENT_STATUSES: ResidentStatus[] = [
  ResidentStatus.ACTIVE,
  ResidentStatus.NOTICE_GIVEN,
];

type ResidentSweepDb = {
  resident: {
    findMany(args: {
      where: Record<string, unknown>;
      select: { id: true; externalId: true };
    }): Promise<Array<{ id: string; externalId: string | null }>>;
    updateMany(args: {
      where: Record<string, unknown>;
      data: { status: ResidentStatus };
    }): Promise<{ count: number }>;
  };
};

export async function markResidentsAbsentFromDirectoryPast(
  db: ResidentSweepDb,
  args: {
    orgId: string;
    propertyIds: string[];
    seenExternalIds: ReadonlySet<string>;
    now: Date;
  },
): Promise<number> {
  if (args.propertyIds.length === 0) return 0;
  const candidates = await db.resident.findMany({
    where: {
      orgId: args.orgId,
      externalSystem: "appfolio",
      propertyId: { in: args.propertyIds },
      status: { in: OPEN_RESIDENT_STATUSES },
      moveOutDate: { lt: args.now },
    },
    select: { id: true, externalId: true },
  });
  const ids = candidates
    .filter((r) => r.externalId && !args.seenExternalIds.has(r.externalId))
    .map((r) => r.id);
  let moved = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const res = await db.resident.updateMany({
      // Re-check status and moveOutDate against a concurrent writer.
      where: {
        id: { in: ids.slice(i, i + CHUNK) },
        status: { in: OPEN_RESIDENT_STATUSES },
        moveOutDate: { lt: args.now },
      },
      data: { status: ResidentStatus.PAST },
    });
    moved += res.count;
  }
  return moved;
}
