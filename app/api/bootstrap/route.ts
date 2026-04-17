import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Use /api/admin/bootstrap instead" },
    { status: 410 }
  );
}
