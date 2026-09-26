/**
 * Pure streak logic for the cron-health alert. Kept free of prisma/email so
 * it can be unit-tested.
 *
 * A job is "stuck" when its most recent finished runs are all non-ok
 * (partial / error / timeout). The streak starts at the oldest run in that
 * trailing non-ok run. We alert exactly once per streak: when the streak
 * start falls in (now - 2h, now - 1h], which an hourly checker hits once.
 * A streak that reaches the edge of the fetched window started earlier and
 * was already alerted on, so it stays quiet.
 */
export type CronRunRow = { jobName: string; startedAt: Date; status: string };

export type StuckCron = {
  jobName: string;
  status: string;
  badSince: Date;
  badRuns: number;
};

export const STUCK_AFTER_MS = 60 * 60 * 1000;
export const CHECK_INTERVAL_MS = 60 * 60 * 1000;

const BAD = new Set(["partial", "error", "timeout"]);

export function findNewlyStuckCrons(
  runs: CronRunRow[],
  now: Date,
): StuckCron[] {
  const byJob = new Map<string, CronRunRow[]>();
  for (const r of runs) {
    if (r.status === "running") continue;
    const list = byJob.get(r.jobName) ?? [];
    list.push(r);
    byJob.set(r.jobName, list);
  }

  const upper = now.getTime() - STUCK_AFTER_MS;
  const lower = upper - CHECK_INTERVAL_MS;
  const stuck: StuckCron[] = [];

  for (const [jobName, list] of byJob) {
    const newestFirst = [...list].sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
    );
    let i = 0;
    while (i < newestFirst.length && BAD.has(newestFirst[i].status)) i += 1;
    if (i === 0) continue; // latest run is ok
    if (i === newestFirst.length) continue; // streak reaches window edge: already alerted
    const badSince = newestFirst[i - 1].startedAt;
    const t = badSince.getTime();
    if (t > lower && t <= upper) {
      stuck.push({
        jobName,
        status: newestFirst[0].status,
        badSince,
        badRuns: i,
      });
    }
  }
  return stuck.sort((a, b) => a.jobName.localeCompare(b.jobName));
}
