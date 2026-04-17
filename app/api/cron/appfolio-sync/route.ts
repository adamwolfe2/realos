import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncListingsForOrg } from "@/lib/integrations/appfolio";

// GET /api/cron/appfolio-sync
// Called hourly by Vercel Cron. Syncs every AppFolio integration whose
// autoSyncEnabled=true and whose lastSyncAt is older than its
// syncFrequencyMinutes. Requires Bearer CRON_SECRET.
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

  const integrations = await prisma.appFolioIntegration.findMany({
    where: { autoSyncEnabled: true },
  });

  const results: Array<{ orgId: string } & Awaited<ReturnType<typeof syncListingsForOrg>>> = [];
  for (const integration of integrations) {
    const minutes = integration.syncFrequencyMinutes ?? 60;
    const cutoff = Date.now() - minutes * 60 * 1000;
    if (integration.lastSyncAt && integration.lastSyncAt.getTime() > cutoff) {
      continue;
    }
    const r = await syncListingsForOrg(integration.orgId);
    results.push({ orgId: integration.orgId, ...r });
  }

  return NextResponse.json({
    processed: results.length,
    integrations: integrations.length,
    results,
  });
}
