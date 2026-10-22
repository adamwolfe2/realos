import { LeaseStatus, type Prisma } from "@prisma/client";

// "Occupied now": an open lease (ACTIVE, or EXPIRING = notice given / ending
// within 60 days) whose term covers asOf. The date guard keeps stale rows
// out: until #192 the AppFolio sync never ended a lease, so Telegraph
// Commons showed 177 "active" leases on 100 units.
// ponytail: excludes month-to-month holdovers past their end date (TC: 2);
// drop the endDate guard once the sync's ENDED status is trusted everywhere.
// endDate is a date-only AppFolio bound stored as midnight UTC and is
// inclusive, so compare it against the start of asOf's UTC day: a lease
// ending today still counts all day.
export function currentLeaseWhere(asOf: Date) {
  const dayStart = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );
  return {
    status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
    AND: [
      { OR: [{ startDate: null }, { startDate: { lte: asOf } }] },
      { OR: [{ endDate: null }, { endDate: { gte: dayStart } }] },
    ],
  } satisfies Prisma.LeaseWhereInput;
}
