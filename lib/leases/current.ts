import { LeaseStatus, type Prisma } from "@prisma/client";

// "Occupied now": an open lease (ACTIVE, or EXPIRING = notice given / ending
// within 60 days) whose term covers asOf. The date guard keeps stale rows
// out: until #192 the AppFolio sync never ended a lease, so Telegraph
// Commons showed 177 "active" leases on 100 units.
// ponytail: excludes month-to-month holdovers past their end date (TC: 2);
// drop the endDate guard once the sync's ENDED status is trusted everywhere.
export function currentLeaseWhere(asOf: Date) {
  return {
    status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
    AND: [
      { OR: [{ startDate: null }, { startDate: { lte: asOf } }] },
      { OR: [{ endDate: null }, { endDate: { gte: asOf } }] },
    ],
  } satisfies Prisma.LeaseWhereInput;
}
