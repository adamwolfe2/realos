import { NextRequest, NextResponse } from "next/server";
import { recordCronRun } from "@/lib/health/cron-run";

// TODO(Sprint 10): nurture unconverted intake submissions (day 1, 3, 7 follow-up
// until consultation booked or submission archived). Records a CronRun row so
// the system page shows the schedule is firing.
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
  return recordCronRun("intake-nurture", async () => ({
    result: NextResponse.json({
      ok: true,
      stub: true,
      message: "intake-nurture stub, rewritten in Sprint 10",
    }),
    recordsProcessed: 0,
  }));
}
