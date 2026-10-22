// Stuck-RUNNING SeoScanJob reaper, used by app/api/cron/seo-scan-worker.
// Re-queues a dead job, or fails it once it hits maxAttempts. Counts only
// reaps that actually landed; a failed update is logged and reported so the
// cron run reads partial instead of ok.
type ReaperDb = {
  seoScanJob: {
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
};

export async function reapStuckScanJobs(
  db: ReaperDb,
  stuck: Array<{ id: string; attempts: number }>,
  maxAttempts: number,
): Promise<{ recycled: number; abandoned: number; errors: string[] }> {
  let recycled = 0;
  let abandoned = 0;
  const errors: string[] = [];
  for (const j of stuck) {
    const abandon = j.attempts + 1 >= maxAttempts;
    const data = abandon
      ? {
          status: "FAILED",
          error: "Exceeded max attempts after stuck-RUNNING reaping",
          finishedAt: new Date(),
          attempts: { increment: 1 },
        }
      : {
          status: "QUEUED",
          attempts: { increment: 1 },
          startedAt: null,
          progressStage: "Re-queued after timeout",
          progressPct: 0,
        };
    try {
      await db.seoScanJob.update({ where: { id: j.id }, data });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[seo-scan-worker] reaper update failed", j.id, message);
      errors.push(`reap ${j.id}: ${message}`);
      continue;
    }
    if (abandon) abandoned += 1;
    else recycled += 1;
  }
  return { recycled, abandoned, errors };
}
