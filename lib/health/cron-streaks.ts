/**
 * Pure logic for the daily cron-health digest. Kept free of prisma/email so
 * it can be unit-tested.
 *
 * A job is "failing" when its most recent finished run is partial / error /
 * timeout and that streak is over an hour old. Jobs with no clean run in the
 * last CHRONIC_AFTER_MS are "chronic": they stay on /admin/system but are
 * left out of the email so a known-broken job doesn't mail ops every day.
 */
export type CronRunRow = { jobName: string; startedAt: Date; status: string };

export type StuckCron = {
  jobName: string;
  status: string;
  badSince: Date;
  badRuns: number;
};

export const STUCK_AFTER_MS = 60 * 60 * 1000;
export const CHRONIC_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Longest cron maxDuration is 300s; a run still "running" after this was killed. */
export const STALE_RUNNING_MS = 20 * 60 * 1000;

const BAD = new Set(["partial", "error", "timeout"]);

export function findFailingCrons(runs: CronRunRow[], now: Date): StuckCron[] {
  const byJob = new Map<string, CronRunRow[]>();
  for (const r of runs) {
    // recordCronRun can't update a run the platform killed at maxDuration, so
    // it stays "running" forever. Past STALE_RUNNING_MS it's a timeout;
    // younger rows may still be in flight and are ignored.
    let row = r;
    if (r.status === "running") {
      if (now.getTime() - r.startedAt.getTime() < STALE_RUNNING_MS) continue;
      row = { ...r, status: "timeout" };
    }
    const list = byJob.get(row.jobName) ?? [];
    list.push(row);
    byJob.set(row.jobName, list);
  }

  const failing: StuckCron[] = [];
  for (const [jobName, list] of byJob) {
    const newestFirst = [...list].sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
    );
    let i = 0;
    while (i < newestFirst.length && BAD.has(newestFirst[i].status)) i += 1;
    if (i === 0) continue; // latest run is ok
    const badSince = newestFirst[i - 1].startedAt;
    if (now.getTime() - badSince.getTime() < STUCK_AFTER_MS) continue;
    failing.push({ jobName, status: newestFirst[0].status, badSince, badRuns: i });
  }
  return failing.sort((a, b) => a.jobName.localeCompare(b.jobName));
}

/** Split failing jobs into ones worth emailing and chronic ones (no clean run in 7 days). */
export function splitChronic(
  failing: StuckCron[],
  jobsWithRecentOk: Set<string>,
): { fresh: StuckCron[]; chronic: StuckCron[] } {
  return {
    fresh: failing.filter((s) => jobsWithRecentOk.has(s.jobName)),
    chronic: failing.filter((s) => !jobsWithRecentOk.has(s.jobName)),
  };
}
