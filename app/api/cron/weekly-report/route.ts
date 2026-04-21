import { NextResponse } from "next/server";
import { recordCronRun } from "@/lib/health/cron-run";

// TODO(Sprint 10): weekly performance report to agency ops with per-tenant
// lead counts, ad spend, chatbot conversions, and at-risk tenants flagged.
export async function GET() {
  return recordCronRun("weekly-report", async () => ({
    result: NextResponse.json({
      ok: true,
      stub: true,
      message: "weekly-report stub, rewritten in Sprint 10",
    }),
    recordsProcessed: 0,
  }));
}
