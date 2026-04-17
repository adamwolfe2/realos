import { NextResponse } from "next/server";

// TODO(Sprint 10): nurture unconverted intake submissions (day 1, 3, 7 follow-up
// until consultation booked or submission archived).
export async function GET() {
  return NextResponse.json({
    ok: true,
    stub: true,
    message: "intake-nurture stub, rewritten in Sprint 10",
  });
}
