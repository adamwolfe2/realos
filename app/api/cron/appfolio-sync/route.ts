import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runAppfolioSync } from "@/lib/integrations/appfolio-sync";
import { syncListingsForOrg } from "@/lib/integrations/appfolio";
import { recordCronRun } from "@/lib/health/cron-run";

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
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return recordCronRun("appfolio-sync", async () => {
    const integrations = await prisma.appFolioIntegration.findMany({
      where: {
        autoSyncEnabled: true,
        OR: [
          { clientIdEncrypted: { not: null } },
          { apiKeyEncrypted: { not: null } },
        ],
      },
    });

    const results: Array<{
      orgId: string;
      ok: boolean;
      stats?: unknown;
      error?: string;
      skipped?: boolean;
    }> = [];

    for (const integration of integrations) {
      const minutes = integration.syncFrequencyMinutes ?? 60;
      const cutoff = Date.now() - minutes * 60 * 1000;
      if (integration.lastSyncAt && integration.lastSyncAt.getTime() > cutoff) {
        results.push({ orgId: integration.orgId, ok: true, skipped: true });
        continue;
      }

      const hasRestCreds =
        !!integration.clientIdEncrypted &&
        (!!integration.clientSecretEncrypted || !!integration.apiKeyEncrypted);

      if (hasRestCreds) {
        try {
          const r = await runAppfolioSync(integration.orgId);
          results.push({
            orgId: integration.orgId,
            ok: r.ok,
            stats: r.stats,
            error: r.error,
          });
          // runAppfolioSync handles its own DB persistence, but if it returned
          // ok=false without throwing we still want lastError surfaced.
          if (!r.ok && r.error) {
            await prisma.appFolioIntegration.update({
              where: { orgId: integration.orgId },
              data: { syncStatus: "error", lastError: r.error },
            }).catch(() => undefined);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          results.push({ orgId: integration.orgId, ok: false, error: message });
          // Persist the unexpected throw so the portal user sees it.
          await prisma.appFolioIntegration.update({
            where: { orgId: integration.orgId },
            data: { syncStatus: "error", lastError: message },
          }).catch(() => undefined);
        }
      } else {
        // Embed-fallback path for Core-plan tenants.
        try {
          const r = await syncListingsForOrg(integration.orgId);
          results.push({
            orgId: integration.orgId,
            ok: r.error == null,
            stats: { listingsUpserted: r.synced },
            error: r.error ?? undefined,
          });
          // syncListingsForOrg updates DB on success/error, but guard against
          // any gap by persisting lastSyncAt on success.
          if (r.error == null) {
            await prisma.appFolioIntegration.update({
              where: { orgId: integration.orgId },
              data: { syncStatus: "idle", lastSyncAt: new Date(), lastError: null },
            }).catch(() => undefined);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          results.push({ orgId: integration.orgId, ok: false, error: message });
          await prisma.appFolioIntegration.update({
            where: { orgId: integration.orgId },
            data: { syncStatus: "error", lastError: message },
          }).catch(() => undefined);
        }
      }
    }

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
