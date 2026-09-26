import { isPayingSubscription } from "@/lib/ai/quota";

// Order for the daily aeo-scan batch. The run only fits ~2 orgs before
// maxDuration, so order decides who gets scanned at all:
//   1. paying orgs whose last scan is a week old (or never) — SG's weekly
//      report needs a fresh scan every week;
//   2. then everyone else, stalest first.
// Before this, never-scanned trial orgs that write no rows sat at the front
// forever and the paying customer was scanned about once every three weeks.
export const PAYING_RESCAN_MS = 6 * 24 * 60 * 60 * 1000;

export function orderOrgsForAeoScan<
  T extends { id: string; subscriptionStatus: string | null },
>(orgs: T[], lastScanMs: Map<string, number>, nowMs: number): T[] {
  const last = (o: T) => lastScanMs.get(o.id) ?? 0;
  const due = (o: T) =>
    isPayingSubscription(o.subscriptionStatus) &&
    nowMs - last(o) >= PAYING_RESCAN_MS;
  return [...orgs].sort((a, b) => {
    const d = Number(due(b)) - Number(due(a));
    return d !== 0 ? d : last(a) - last(b);
  });
}
