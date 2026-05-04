import { NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { runAppfolioSync } from "@/lib/integrations/appfolio-sync";
import { syncListingsForOrg } from "@/lib/integrations/appfolio";
import { prisma } from "@/lib/db";

// Vercel default for on-demand HTTP routes is 60s on Pro; the AppFolio
// REST sync routinely needs 90–120s for a fresh tenant pulling 90 days
// of guest_cards + tenant_directory + unit_directory + property_directory
// + tenant_directory + rent_roll + delinquency + work_order. Without
// this bump the function gets killed mid-flight, leaves syncStatus
// wedged in "syncing", and the user sees a 17m+ "syncing" banner that
// will never complete.
export const maxDuration = 300; // matches the cron handler

// Tenant-scoped on-demand AppFolio sync. Powers both the manual "Run sync"
// button on the operations pages and the StaleOnLoadTrigger that fires
// when a user opens a stale page.
//
// Behaviour:
//   1. REST creds present → run full report sync (residents, leases, work
//      orders, rent roll, delinquency).
//   2. Embed fallback only → scrape the listings page so availability is
//      at least surfaced.
//   3. Returns sync stats so the UI can show how many records updated.
//
// Rate-limited by the same per-integration concurrency cap as the cron job
// at the AppFolio API layer; the on-demand path has no extra throttle of
// its own beyond the StaleOnLoadTrigger's sessionStorage dedupe.
export async function POST() {
  try {
    const scope = await requireScope();

    const integration = await prisma.appFolioIntegration.findUnique({
      where: { orgId: scope.orgId },
      select: {
        clientIdEncrypted: true,
        clientSecretEncrypted: true,
        apiKeyEncrypted: true,
        useEmbedFallback: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { ok: false, error: "AppFolio not connected" },
        { status: 409 }
      );
    }

    const hasRestCreds =
      Boolean(integration.clientIdEncrypted) &&
      (Boolean(integration.clientSecretEncrypted) ||
        Boolean(integration.apiKeyEncrypted));

    if (hasRestCreds) {
      const result = await runAppfolioSync(scope.orgId);
      return NextResponse.json(result, {
        status: result.ok ? 200 : 409,
      });
    }

    // Embed fallback path
    const result = await syncListingsForOrg(scope.orgId);
    return NextResponse.json(
      {
        ok: result.error == null,
        stats: { listingsUpserted: result.synced },
        error: result.error,
      },
      { status: result.error ? 409 : 200 }
    );
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[appfolio-sync] tenant on-demand sync failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
