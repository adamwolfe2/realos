import { NextResponse } from "next/server";
import { recordCronRun } from "@/lib/health/cron-run";

// TODO(Sprint 10): nurture unconverted intake submissions (day 1, 3, 7 follow-up
// until consultation booked or submission archived). Records a CronRun row so
// the system page shows the schedule is firing.
export async function GET() {
  return recordCronRun("intake-nurture", async () => ({
    result: NextResponse.json({
      ok: true,
      stub: true,
      message: "intake-nurture stub, rewritten in Sprint 10",
    }),
    recordsProcessed: 0,
  }));
}
