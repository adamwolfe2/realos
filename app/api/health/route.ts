import { NextResponse } from "next/server";
import { runSystemHealth } from "@/lib/health/checks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health
//
// Comprehensive system health probe. Used by uptime monitors and the
// `/admin/system` dashboard. Returns 503 when overall status is `down`,
// 200 otherwise. All checks run in parallel with per-check timeouts so a
// single slow dependency cannot stall the response.
export async function GET() {
  const health = await runSystemHealth();
  const httpStatus = health.status === "down" ? 503 : 200;

  return NextResponse.json(health, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
