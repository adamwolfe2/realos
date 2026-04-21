/**
 * recordCronRun — wraps a cron handler so it writes a CronRun row at start
 * and updates it on finish (success/failure/timeout). Falls back to a noop if
 * the table doesn't exist yet so a missing migration cannot break a cron.
 *
 * Usage:
 *   return recordCronRun("appfolio-sync", async () => {
 *     const stats = await runAppfolioSync(...)
 *     return {
 *       result: NextResponse.json({ ok: true, stats }),
 *       recordsProcessed: stats.processed,
 *     }
 *   })
 *
 * The wrapper returns whatever the inner handler returns as `result`. If the
 * inner handler throws, the row is marked `error` and the throw is re-raised
 * so the caller's error path still runs.
 */
import "server-only";
import { prisma } from "@/lib/db";

export type CronStatus = "ok" | "error" | "timeout";

export interface CronRunHandlerReturn<T> {
  result: T;
  recordsProcessed?: number;
}

export async function recordCronRun<T>(
  jobName: string,
  handler: () => Promise<CronRunHandlerReturn<T>>
): Promise<T> {
  const startedAt = new Date();
  let runId: string | null = null;
  try {
    const created = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "CronRun" ("id", "jobName", "startedAt", "status")
      VALUES (gen_random_uuid()::text, ${jobName}, ${startedAt}, 'running')
      RETURNING "id"
    `.catch(() => [] as { id: string }[]);
    runId = created[0]?.id ?? null;
  } catch {
    // Table missing or DB unavailable: silently skip recording.
    runId = null;
  }

  try {
    const handlerReturn = await handler();
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const recordsProcessed = handlerReturn.recordsProcessed ?? null;

    if (runId) {
      await prisma
        .$executeRaw`
          UPDATE "CronRun"
          SET "finishedAt" = ${finishedAt},
              "status" = 'ok',
              "durationMs" = ${durationMs},
              "recordsProcessed" = ${recordsProcessed}
          WHERE "id" = ${runId}
        `.catch(() => 0);
    }
    return handlerReturn.result;
  } catch (err) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const message = err instanceof Error ? err.message : String(err);
    if (runId) {
      await prisma
        .$executeRaw`
          UPDATE "CronRun"
          SET "finishedAt" = ${finishedAt},
              "status" = 'error',
              "durationMs" = ${durationMs},
              "error" = ${message}
          WHERE "id" = ${runId}
        `.catch(() => 0);
    }
    throw err;
  }
}
