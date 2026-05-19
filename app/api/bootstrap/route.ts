// Edge runtime — stateless lookup, no DB, no Clerk session.
// Cold start ~30ms vs ~2s on Node.
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST() {
  return NextResponse.json(
    { error: "Use /api/admin/bootstrap instead" },
    { status: 410 }
  );
}
