import { NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";

// Tenant-scoped reset for a wedged AppFolio sync. The on-demand sync
// route kicks off runAppfolioSync, which sets syncStatus="syncing" + a
// syncStartedAt timestamp, then runs the 8-phase pipeline and clears
// both at the end. When the underlying function gets killed by Vercel's
// maxDuration before the cleanup writes (network stall to AppFolio,
// cold-start scheduling, etc.) the row gets stuck in "syncing" forever.
//
// This endpoint exists so the UI's "Clear stuck sync" button can reset
// the row without bouncing through admin tooling. Idempotent: only
// clears rows that have actually been syncing for >10 min (anything
// fresher is presumed live and left alone).

const STUCK_AFTER_MS = 10 * 60 * 1000;

export async function POST() {
  try {
    const scope = await requireScope();
    const integ = await prisma.appFolioIntegration.findUnique({
      where: { orgId: scope.orgId },
      select: {
        id: true,
        syncStatus: true,
        syncStartedAt: true,
      },
    });
    if (!integ) {
      return NextResponse.json(
        { ok: false, error: "AppFolio not connected for this tenant." },
        { status: 404 }
      );
    }
    if (integ.syncStatus !== "syncing") {
      // Already idle/error. No-op success so the UI's optimistic
      // "Clear" click doesn't surface a confusing failure.
      return NextResponse.json({ ok: true, cleared: false });
    }
    if (
      integ.syncStartedAt &&
      Date.now() - integ.syncStartedAt.getTime() < STUCK_AFTER_MS
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sync is still running (started less than 10 minutes ago). Wait for it to finish or fail naturally before clearing.",
        },
        { status: 409 }
      );
    }
    const elapsedMin = integ.syncStartedAt
      ? Math.round((Date.now() - integ.syncStartedAt.getTime()) / 60000)
      : null;
    await prisma.appFolioIntegration.update({
      where: { orgId: scope.orgId },
      data: {
        syncStatus: "error",
        syncStartedAt: null,
        lastError: elapsedMin
          ? `Sync timed out after ${elapsedMin} minutes — Vercel function killed before completion. Click Retry to re-run.`
          : "Sync timed out — function killed before completion. Click Retry to re-run.",
      },
    });
    return NextResponse.json({ ok: true, cleared: true });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[appfolio-clear-stuck] failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
