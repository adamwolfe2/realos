import { NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { runSeoSync } from "@/lib/integrations/seo-sync";
import { prisma } from "@/lib/db";
import { checkRateLimit, rateLimited, seoSyncLimiter } from "@/lib/rate-limit";

// Vercel default for on-demand HTTP routes is 60s on Pro; runSeoSync
// touches GSC + GA4 (each 4 fetch passes) and chunked upserts. Bump
// to 120s to match the cron handler.
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// POST /api/tenant/seo/sync
//
// Tenant-scoped on-demand SEO (GSC + GA4) sync. Powers the manual "Run
// sync" button on /portal/seo + the StaleOnLoadTrigger that fires when
// an operator opens the page after data has gone stale.
//
// Pre-fix the cron ran every 6 hours and there was no on-demand path
// from the dashboard at all — meaning if an operator wanted fresh GSC
// data right now they had to wait up to 6h for the next cron tick.
// Now this endpoint runs the same sync the cron does, scoped to the
// caller's org, debounced 60s per org via Upstash so a rapid-clicker
// or two tabs racing don't fan out into concurrent GA4 quota burns.
// ---------------------------------------------------------------------------

export async function POST() {
  try {
    const scope = await requireScope();

    // Per-org debounce (60s). Keyed by orgId so two tabs in the same
    // browser / two operators on the same tenant don't each kick off
    // a parallel GSC + GA4 run. The cron continues independent of
    // this limiter — operators always get fresh data within 30 min
    // regardless of whether the limiter fires.
    const { allowed } = await checkRateLimit(
      seoSyncLimiter,
      `seo-sync:${scope.orgId}`,
    );
    if (!allowed) {
      return rateLimited(
        "SEO sync was just triggered for this org. Try again in a minute.",
        60,
      );
    }

    // Ensure at least one SeoIntegration exists for this org before
    // spinning up the worker. Avoids a 409 from the lib with a more
    // honest 404 here.
    const count = await prisma.seoIntegration.count({
      where: { orgId: scope.orgId },
    });
    if (count === 0) {
      return NextResponse.json(
        { ok: false, error: "No SEO integrations connected." },
        { status: 404 },
      );
    }

    const result = await runSeoSync(scope.orgId);
    return NextResponse.json(result, {
      status: result.ok ? 200 : 409,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[seo-sync] tenant on-demand sync failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
