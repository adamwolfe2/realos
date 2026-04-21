import { NextResponse } from "next/server";
import { recordCronRun } from "@/lib/health/cron-run";

// TODO(Sprint 10): implement real-estate onboarding drip (intake-submitted,
// consultation-booked, contract-signed, build-in-progress touch points).
export async function GET() {
  return recordCronRun("onboarding-drip", async () => ({
    result: NextResponse.json({
      ok: true,
      stub: true,
      message: "onboarding-drip stub, rewritten in Sprint 10",
    }),
    recordsProcessed: 0,
  }));
}
