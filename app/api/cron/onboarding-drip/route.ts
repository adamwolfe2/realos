import { NextResponse } from "next/server";

// TODO(Sprint 10): implement real-estate onboarding drip (intake-submitted,
// consultation-booked, contract-signed, build-in-progress touch points).
export async function GET() {
  return NextResponse.json({
    ok: true,
    stub: true,
    message: "onboarding-drip stub, rewritten in Sprint 10",
  });
}
