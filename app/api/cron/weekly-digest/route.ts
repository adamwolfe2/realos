import { NextResponse } from "next/server";

// TODO(Sprint 10): rebuild weekly digest for tenants covering lead volume,
// chatbot conversations, pixel-identified visitors, and application pipeline.
export async function GET() {
  return NextResponse.json({
    ok: true,
    stub: true,
    message: "weekly-digest stub, rewritten in Sprint 10",
  });
}
