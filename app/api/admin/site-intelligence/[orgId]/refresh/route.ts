/**
 * POST /api/admin/site-intelligence/[orgId]/refresh
 *
 * Admin-only. Re-runs the full site-intelligence ingest for the given org
 * with `force: true`, bypassing the 24h crawl-freshness gate. Returns the
 * stats blob from the orchestrator.
 *
 * Auth: requireAdmin() — ADMIN or OPS role.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { ingestOrgIntelligence } from "@/lib/intelligence/site-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { orgId } = await params;
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  try {
    const result = await ingestOrgIntelligence({ orgId, force: true });
    return NextResponse.json({
      ok: result.ok,
      orgId: result.orgId,
      stats: result.stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[admin.site-intelligence.refresh] orgId=${orgId} failed:`,
      message,
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
