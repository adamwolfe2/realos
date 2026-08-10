import { LeadSource } from "@prisma/client";

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 365;

export type AttributionDateRange = {
  fromDate: Date;
  toDate: Date;
  fromIso: string;
  toIso: string;
  dayCount: number;
};

export function parseAttributionSource(raw?: string | null): LeadSource | null {
  return raw && Object.values(LeadSource).includes(raw as LeadSource)
    ? (raw as LeadSource)
    : null;
}

export function parseAttributionDateRange(
  fromRaw?: string | null,
  toRaw?: string | null,
  now: Date = new Date(),
): AttributionDateRange {
  const defaultFrom = new Date(now.getTime() - 30 * DAY_MS);
  const parsedFrom = parseIsoDate(fromRaw) ?? defaultFrom;
  const parsedTo = parseIsoDate(toRaw) ?? now;
  const validRange =
    parsedTo >= parsedFrom &&
    parsedTo.getTime() - parsedFrom.getTime() <= MAX_RANGE_DAYS * DAY_MS;
  const safeFrom = validRange ? parsedFrom : defaultFrom;
  const safeTo = validRange ? parsedTo : now;
  const fromDate = startOfUtcDay(safeFrom);
  const toDate = endOfUtcDay(safeTo);

  return {
    fromDate,
    toDate,
    fromIso: toIsoDay(fromDate),
    toIso: toIsoDay(toDate),
    dayCount: Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS),
  };
}

function parseIsoDate(raw?: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59),
  );
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
