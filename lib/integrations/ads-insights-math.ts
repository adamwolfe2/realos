import { LeadStatus } from "@prisma/client";

// Pure helpers behind /portal/ads ranges, weekly progressions and the
// ad-level checks. No DB access, so every rule here is unit-tested.

export const ADS_RANGES = [7, 28, 90] as const;
export type AdsRangeDays = (typeof ADS_RANGES)[number];

export function parseAdsRange(raw: string | string[] | undefined): AdsRangeDays {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return (ADS_RANGES as readonly number[]).includes(n) ? (n as AdsRangeDays) : 28;
}

// A lead counts as toured once it reaches TOURED or any later stage.
export const TOURED_OR_LATER: ReadonlySet<LeadStatus> = new Set([
  LeadStatus.TOURED,
  LeadStatus.APPLICATION_SENT,
  LeadStatus.APPLIED,
  LeadStatus.APPROVED,
  LeadStatus.SIGNED,
]);

/** Monday (UTC) of the week containing `d`, as YYYY-MM-DD. */
export function weekStart(d: Date): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  return day.toISOString().slice(0, 10);
}

export type WeekRow = { week: string; spendCents: number; leads: number; tours: number; signed: number };

export function weeklyFunnel(
  spend: readonly { date: Date; spendCents: number }[],
  leads: readonly { createdAt: Date; status: LeadStatus }[],
): WeekRow[] {
  const weeks = new Map<string, WeekRow>();
  const row = (week: string) => {
    const r = weeks.get(week) ?? { week, spendCents: 0, leads: 0, tours: 0, signed: 0 };
    weeks.set(week, r);
    return r;
  };
  for (const s of spend) row(weekStart(s.date)).spendCents += s.spendCents;
  for (const l of leads) {
    const r = row(weekStart(l.createdAt));
    r.leads += 1;
    if (TOURED_OR_LATER.has(l.status)) r.tours += 1;
    if (l.status === LeadStatus.SIGNED) r.signed += 1;
  }
  return [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week));
}

// Creative fatigue: click-through in the last 7 days vs the first 7 days of
// the window. Needs enough impressions on both ends to mean anything.
export const FATIGUE_DROP = 0.3;
const FATIGUE_MIN_IMPRESSIONS = 1000;

export function fatigue(
  daily: readonly { date: Date; impressions: number; clicks: number }[],
): { earlyCtr: number; lateCtr: number; drop: number } | null {
  if (daily.length < 14) return null;
  const sorted = [...daily].sort((a, b) => a.date.getTime() - b.date.getTime());
  const sum = (rows: typeof sorted) =>
    rows.reduce((t, r) => ({ i: t.i + r.impressions, c: t.c + r.clicks }), { i: 0, c: 0 });
  const early = sum(sorted.slice(0, 7));
  const late = sum(sorted.slice(-7));
  if (early.i < FATIGUE_MIN_IMPRESSIONS || late.i < FATIGUE_MIN_IMPRESSIONS || early.c === 0) return null;
  const earlyCtr = early.c / early.i;
  const lateCtr = late.c / late.i;
  return { earlyCtr, lateCtr, drop: 1 - lateCtr / earlyCtr };
}

export type FormatRow = { format: string; ads: number; spendCents: number; leads: number; clicks: number; impressions: number };

export function byFormat(
  items: readonly { format: string | null; spendCents: number; leads: number; clicks: number; impressions: number }[],
): FormatRow[] {
  const m = new Map<string, FormatRow>();
  for (const it of items) {
    const format = it.format ?? "text";
    const r = m.get(format) ?? { format, ads: 0, spendCents: 0, leads: 0, clicks: 0, impressions: 0 };
    r.ads += 1;
    r.spendCents += it.spendCents;
    r.leads += it.leads;
    r.clicks += it.clicks;
    r.impressions += it.impressions;
    m.set(format, r);
  }
  return [...m.values()].sort((a, b) => b.spendCents - a.spendCents);
}

// Budget shift: the cheapest and priciest property by cost per lease, when
// they differ at least 2x and both have enough leases to trust the number.
export type BudgetShift = { from: { id: string; name: string; costPerLeaseCents: number }; to: { id: string; name: string; costPerLeaseCents: number }; ratio: number };

export function budgetShift(
  rows: readonly { propertyId: string | null; name: string; spendCents: number; signed: number }[],
  minLeases = 2,
): BudgetShift | null {
  const priced = rows
    .filter((r) => r.propertyId && r.signed >= minLeases && r.spendCents > 0)
    .map((r) => ({ id: r.propertyId!, name: r.name, costPerLeaseCents: Math.round(r.spendCents / r.signed) }))
    .sort((a, b) => a.costPerLeaseCents - b.costPerLeaseCents);
  if (priced.length < 2) return null;
  const to = priced[0];
  const from = priced[priced.length - 1];
  const ratio = from.costPerLeaseCents / to.costPerLeaseCents;
  return ratio >= 2 ? { from, to, ratio } : null;
}
