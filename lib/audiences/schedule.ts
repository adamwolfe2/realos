import { AudienceScheduleFrequency } from "@prisma/client";

// ---------------------------------------------------------------------------
// computeNextRunAt — pure function that returns the next UTC instant a
// schedule should fire at, given a frequency, optional day-of-week, hour-of-day
// (UTC), and a "from" anchor (defaults to now()).
//
// DAILY:
//   The next time today's `hourUtc` occurs. If the current UTC clock is
//   already past today's hour, advances by one day.
//
// WEEKLY:
//   The next time the (dayOfWeek, hourUtc) combo occurs strictly in the
//   future. dayOfWeek is 0-6 with Sunday=0 (matches JS Date#getUTCDay()).
//   If today matches dayOfWeek but the hour has already passed, the next run
//   is one full week away.
//
// All math is in UTC. No timezone conversion happens here.
// ---------------------------------------------------------------------------

export function computeNextRunAt(
  frequency: AudienceScheduleFrequency,
  dayOfWeek: number | null | undefined,
  hourUtc: number,
  fromDate: Date = new Date(),
): Date {
  if (!Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) {
    throw new Error(`hourUtc must be an integer 0-23, got ${hourUtc}`);
  }
  const next = new Date(
    Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate(),
      hourUtc,
      0,
      0,
      0,
    ),
  );

  if (frequency === "DAILY") {
    if (next.getTime() <= fromDate.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }

  // WEEKLY
  if (
    dayOfWeek == null ||
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6
  ) {
    throw new Error(
      `dayOfWeek must be an integer 0-6 for WEEKLY frequency, got ${dayOfWeek}`,
    );
  }
  const currentDay = next.getUTCDay();
  let dayDelta = dayOfWeek - currentDay;
  if (dayDelta < 0) {
    dayDelta += 7;
  } else if (dayDelta === 0 && next.getTime() <= fromDate.getTime()) {
    // Same day-of-week, but the hour has already passed today: jump one week.
    dayDelta = 7;
  }
  next.setUTCDate(next.getUTCDate() + dayDelta);
  return next;
}

// ---------------------------------------------------------------------------
// Inline test cases (verify mentally; covered by code review).
//
// (All "from" dates are UTC, so .toISOString() shown directly.)
//
// 1) DAILY, hourUtc=6, from "2026-04-28T03:00:00.000Z" (Tue 03:00)
//    → next = "2026-04-28T06:00:00.000Z" (same day, future hour)
//
// 2) DAILY, hourUtc=6, from "2026-04-28T09:00:00.000Z" (Tue 09:00)
//    → next = "2026-04-29T06:00:00.000Z" (hour already passed, +1 day)
//
// 3) WEEKLY, dayOfWeek=1 (Mon), hourUtc=9, from "2026-04-28T08:00:00.000Z"
//    (Tue 08:00) → next = "2026-05-04T09:00:00.000Z" (next Mon at 09:00)
//
// 4) WEEKLY, dayOfWeek=2 (Tue), hourUtc=9, from "2026-04-28T08:00:00.000Z"
//    (Tue 08:00, same day, future hour) → next = "2026-04-28T09:00:00.000Z"
//
// 5) WEEKLY, dayOfWeek=2 (Tue), hourUtc=9, from "2026-04-28T10:00:00.000Z"
//    (Tue 10:00, same day, hour passed) → next = "2026-05-05T09:00:00.000Z"
//    (one full week later)
// ---------------------------------------------------------------------------

// Human-friendly label for a schedule. Used by the UI to render
// "Daily at 06:00 UTC" or "Weekly on Mon at 09:00 UTC".
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function describeSchedule(
  frequency: AudienceScheduleFrequency,
  dayOfWeek: number | null | undefined,
  hourUtc: number,
): string {
  const hour = String(Math.max(0, Math.min(23, hourUtc))).padStart(2, "0");
  if (frequency === "DAILY") {
    return `Daily at ${hour}:00 UTC`;
  }
  const day =
    dayOfWeek != null && dayOfWeek >= 0 && dayOfWeek <= 6
      ? DAY_LABELS[dayOfWeek]
      : "?";
  return `Weekly on ${day} at ${hour}:00 UTC`;
}
