import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runAppfolioSync } from "@/lib/integrations/appfolio-sync";
import { syncListingsForOrg } from "@/lib/integrations/appfolio";
import { recordCronRun } from "@/lib/health/cron-run";
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

  return recordCronRun("appfolio-sync", async () => {
    // Self-heal stuck rows BEFORE pulling the queue. A row left in
    // syncStatus='syncing' with a syncStartedAt > 10 min ago is a
    // killed-mid-flight Vercel function that never wrote its cleanup.
    // The runAppfolioSync concurrency guard already steamrolls these,
    // but flipping them to 'error' here surfaces the failed state in
    // the UI in the meantime instead of leaving operators staring at
    // a perpetual spinner.
    await prisma.appFolioIntegration
      .updateMany({
        where: {
          syncStatus: "syncing",
          syncStartedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
        },
        data: {
          syncStatus: "error",
          syncStartedAt: null,
          lastError:
            "Sync timed out — function killed before completion. Cron auto-cleared the wedged row; this run will retry.",
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
      const minutes = integration.syncFrequencyMinutes ?? 60;
      const cutoff = Date.now() - minutes * 60 * 1000;
      if (integration.lastSyncAt && integration.lastSyncAt.getTime() > cutoff) {
        return { orgId: integration.orgId, ok: true, skipped: true };
      }

      const hasRestCreds =
        !!integration.clientIdEncrypted &&
        (!!integration.clientSecretEncrypted || !!integration.apiKeyEncrypted);

      if (hasRestCreds) {
        try {
          const r = await runAppfolioSync(integration.orgId);
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
  });
}
