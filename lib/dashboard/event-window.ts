// One definition of "happened in this window" for each funnel stage, so
// Leads → Tours → Applications always compare the same days. Rows are dated
// by the real event, not DB insert time: an AppFolio backfill inserts months
// of history "now", and counting by createdAt dumps it all into the current
// window. The upper bound also keeps tours booked for next week out of a
// "last 28 days" count.

type Range = { gte: Date; lt: Date };

const range = (start: Date, end: Date): Range => ({ gte: start, lt: end });

/** Leads by firstSeenAt (always set; the source event date for imports). */
export function leadEventWhere(start: Date, end: Date = new Date()) {
  return { firstSeenAt: range(start, end) };
}

/** Tours by completedAt, else scheduledAt, else createdAt. */
export function tourEventWhere(start: Date, end: Date = new Date()) {
  const r = range(start, end);
  return {
    OR: [
      { completedAt: r },
      { completedAt: null, scheduledAt: r },
      { completedAt: null, scheduledAt: null, createdAt: r },
    ],
  };
}

/** Applications by appliedAt, else receivedAt, else createdAt. */
export function applicationEventWhere(start: Date, end: Date = new Date()) {
  const r = range(start, end);
  return {
    OR: [
      { appliedAt: r },
      { appliedAt: null, receivedAt: r },
      { appliedAt: null, receivedAt: null, createdAt: r },
    ],
  };
}
