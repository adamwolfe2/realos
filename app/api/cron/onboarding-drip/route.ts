import { NextRequest, NextResponse } from "next/server";
import { recordCronRun } from "@/lib/health/cron-run";

// TODO(Sprint 10): implement real-estate onboarding drip (intake-submitted,
// consultation-booked, contract-signed, build-in-progress touch points).
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
  return recordCronRun("onboarding-drip", async () => ({
    result: NextResponse.json({
      ok: true,
      stub: true,
      message: "onboarding-drip stub, rewritten in Sprint 10",
    }),
    recordsProcessed: 0,
  }));
}
