import { NextResponse } from "next/server";
import { runSystemHealthDeep } from "@/lib/health/checks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health/deep
//
// Same checks as `/api/health` but also exercises a real DB read (org count)
// plus the platform pulse and recent cron runs. No auth required so external
// uptime monitors can hit it; nothing returned is sensitive.
export async function GET() {
  const health = await runSystemHealthDeep();
  const httpStatus = health.status === "down" ? 503 : 200;

  return NextResponse.json(health, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
