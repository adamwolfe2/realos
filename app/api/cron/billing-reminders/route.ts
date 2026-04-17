import { NextResponse } from "next/server";

// TODO(Sprint 10): Stripe invoice reminder cadence for past-due tenants.
export async function GET() {
  return NextResponse.json({
    ok: true,
    stub: true,
    message: "billing-reminders stub, rewritten in Sprint 10",
  });
}
