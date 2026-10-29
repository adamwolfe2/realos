import { parseRange, rangeDays } from "@/lib/dashboard/range";

// A reporting window from the URL: ?range=7d|28d|90d, or a custom
// ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive, max 366 days). `priorStart` is
// the equally long window just before, used for growth deltas.

export type ReportWindow = {
  start: Date;
  end: Date;
  priorStart: Date;
  days: number;
  label: string;
  /** Query string fragment that reproduces this window, for links. */
  query: string;
};

const DAY = 24 * 60 * 60 * 1000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function resolveWindow(
  sp: { range?: string; from?: string; to?: string },
  now: Date = new Date(),
): ReportWindow {
  if (sp.from && sp.to && ISO_DAY.test(sp.from) && ISO_DAY.test(sp.to)) {
    const start = new Date(`${sp.from}T00:00:00`);
    const end = new Date(`${sp.to}T23:59:59.999`);
    const days = Math.round((end.getTime() - start.getTime()) / DAY);
    if (!Number.isNaN(days) && days >= 1 && days <= 366 && end.getTime() <= now.getTime() + DAY) {
      const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        start,
        end,
        priorStart: new Date(start.getTime() - days * DAY),
        days,
        label: `${fmt(start)} – ${fmt(end)}`,
        query: `from=${sp.from}&to=${sp.to}`,
      };
    }
  }
  const range = parseRange(sp.range);
  const days = rangeDays(range);
  const start = new Date(now.getTime() - days * DAY);
  return {
    start,
    end: now,
    priorStart: new Date(start.getTime() - days * DAY),
    days,
    label: `Last ${days} days`,
    query: `range=${range}`,
  };
}

/** Signed % change, or null when there is no prior baseline. */
export function pctChange(now: number, prior: number): number | null {
  if (!prior) return null;
  return Math.round(((now - prior) / prior) * 100);
}
