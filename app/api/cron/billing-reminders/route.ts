import { NextRequest, NextResponse } from "next/server";
import { recordCronRun } from "@/lib/health/cron-run";

// TODO(Sprint 10): Stripe invoice reminder cadence for past-due tenants.
// Until then, the handler still records a CronRun row so /admin/system can
// confirm Vercel is firing the schedule.
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
  return recordCronRun("billing-reminders", async () => ({
    result: NextResponse.json({
      ok: true,
      stub: true,
      message: "billing-reminders stub, rewritten in Sprint 10",
    }),
    recordsProcessed: 0,
  }));
}
