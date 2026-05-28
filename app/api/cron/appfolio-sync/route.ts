import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runAppfolioSync } from "@/lib/integrations/appfolio-sync";
import { syncListingsForOrg } from "@/lib/integrations/appfolio";
import { recordCronRun } from "@/lib/health/cron-run";
import { trackCronDuration } from "@/lib/observability/cron-tracker";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// GET /api/cron/appfolio-sync
//
// Called hourly by Vercel Cron. Iterates every AppFolio integration whose
// autoSyncEnabled=true and whose lastSyncAt is older than its
// syncFrequencyMinutes. Requires Bearer CRON_SECRET.
//
// Tenants with REST credentials (clientId + clientSecret) run the full
// reports-based sync. Tenants still on the embed fallback fall through to
// the old listings-only scrape path so they at least get availability data.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("appfolio-sync", () => trackCronDuration("appfolio-sync", async () => {
    // Self-heal stuck rows BEFORE pulling the queue. A row left in
    // syncStatus='syncing' with a syncStartedAt older than the Vercel
    // function timeout (5 min) PLUS a generous safety margin is a
    // genuinely killed-mid-flight job that never wrote its cleanup.
    //
    // Pre-fix the threshold was 10 min flat. This was too aggressive:
    // large tenants (Telegraph Commons + SG Real Estate both have
    // >500 residents) routinely have legitimate runs that span 7-9
    // minutes when AppFolio's reports endpoint is slow. The cron
    // would flip those in-flight runs to 'error' with a generic
    // "Sync timed out" message — exactly the false-positive banner
    // operators were seeing.
    //
    // Now: 8 min threshold (5 min timeout + 3 min safety margin), and
    // we only flag rows where syncStartedAt actually predates the
    // Vercel function limit. If a run is still going at 7 min, leave
    // it alone — it will either complete cleanly or be killed by
    // Vercel and caught on the next cron tick.
    const STUCK_THRESHOLD_MS = 8 * 60 * 1000;
    await prisma.appFolioIntegration
      .updateMany({
        where: {
          syncStatus: "syncing",
          syncStartedAt: { lt: new Date(Date.now() - STUCK_THRESHOLD_MS) },
        },
        data: {
          syncStatus: "error",
          syncStartedAt: null,
          lastError:
            "Sync exceeded Vercel function timeout (5 min). Reduce backfill window or contact support — this run will retry on the next cron tick.",
        },
      })
      .catch((err) => {
        console.warn("[appfolio-sync] auto-clear stuck rows failed:", err);
      });

    const integrations = await prisma.appFolioIntegration.findMany({
      where: {
        autoSyncEnabled: true,
        OR: [
          { clientIdEncrypted: { not: null } },
          { apiKeyEncrypted: { not: null } },
        ],
      },
    });

    type SyncResult = {
      orgId: string;
      ok: boolean;
      stats?: unknown;
      error?: string;
      skipped?: boolean;
    };

    // Run tenants in parallel with a concurrency cap. Sequential execution
    // serialized 6+ tenants to ~6x the wall-clock time and risked Vercel cron
    // timeout. Cap at 4 to avoid hammering AppFolio's rate limit.
    const CONCURRENCY = 4;
    const queue = [...integrations];
    const results: SyncResult[] = [];

    async function processOne(
      integration: (typeof integrations)[number]
    ): Promise<SyncResult> {
      // Default cadence dropped from 60 min to 30 min in line with the
      // tightened Vercel cron schedule (*/30 * * * *). Lease renewals are
      // contractually time-bound — operators on /portal/renewals expect
      // data fresher than the hourly default. Integrations with a
      // custom syncFrequencyMinutes still honor their explicit value.
      const minutes = integration.syncFrequencyMinutes ?? 30;
      const cutoff = Date.now() - minutes * 60 * 1000;
      if (integration.lastSyncAt && integration.lastSyncAt.getTime() > cutoff) {
        return { orgId: integration.orgId, ok: true, skipped: true };
      }

      const hasRestCreds =
        !!integration.clientIdEncrypted &&
        (!!integration.clientSecretEncrypted || !!integration.apiKeyEncrypted);

      // Weekly auto-retry of skipped phases. Pre-fix a phase that auto-
      // skipped after 3 consecutive failures stayed skipped forever
      // unless the operator manually clicked "Retry skipped phases".
      // That meant a transient AppFolio outage from 30 days ago could
      // permanently disable a phase that's working today. Now: if ANY
      // skipped phase hasn't been retried in the last 7 days, the cron
      // fires this run with `retrySkipped:true` so the skipped phases
      // get one fresh attempt. They'll either succeed (and the skip
      // flag clears) or fail and re-arm the skip flag.
      const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;
      const phaseFailures = (integration.lastSyncStats as Record<string, unknown> | null)
        ?.phaseFailures as Record<string, { skipped?: boolean; lastRetryAttemptAt?: string }> | undefined;
      let shouldRetrySkipped = false;
      if (phaseFailures) {
        for (const entry of Object.values(phaseFailures)) {
          if (!entry?.skipped) continue;
          const lastAttempt = entry.lastRetryAttemptAt
            ? new Date(entry.lastRetryAttemptAt).getTime()
            : 0;
          if (Date.now() - lastAttempt > WEEKLY_MS) {
            shouldRetrySkipped = true;
            break;
          }
        }
      }

      if (hasRestCreds) {
        try {
          const r = await runAppfolioSync(integration.orgId, {
            retrySkipped: shouldRetrySkipped,
          });
          if (!r.ok && r.error) {
            await prisma.appFolioIntegration
              .update({
                where: { orgId: integration.orgId },
                data: { syncStatus: "error", lastError: r.error },
              })
              .catch(() => undefined);
          }
          return {
            orgId: integration.orgId,
            ok: r.ok,
            stats: r.stats,
            error: r.error,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          await prisma.appFolioIntegration
            .update({
              where: { orgId: integration.orgId },
              data: { syncStatus: "error", lastError: message },
            })
            .catch(() => undefined);
          return { orgId: integration.orgId, ok: false, error: message };
        }
      }

      // Embed-fallback path for Core-plan tenants.
      try {
        const r = await syncListingsForOrg(integration.orgId);
        if (r.error == null) {
          await prisma.appFolioIntegration
            .update({
              where: { orgId: integration.orgId },
              data: { syncStatus: "idle", lastSyncAt: new Date(), lastError: null },
            })
            .catch(() => undefined);
        }
        return {
          orgId: integration.orgId,
          ok: r.error == null,
          stats: { listingsUpserted: r.synced },
          error: r.error ?? undefined,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await prisma.appFolioIntegration
          .update({
            where: { orgId: integration.orgId },
            data: { syncStatus: "error", lastError: message },
          })
          .catch(() => undefined);
        return { orgId: integration.orgId, ok: false, error: message };
      }
    }

    async function worker() {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        results.push(await processOne(next));
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, integrations.length) }, () =>
        worker()
      )
    );

    return {
      result: NextResponse.json({
        ok: true,
        processed: results.length,
        integrations: integrations.length,
        results,
      }),
      recordsProcessed: results.filter((r) => r.ok && !r.skipped).length,
    };
  }));
}
