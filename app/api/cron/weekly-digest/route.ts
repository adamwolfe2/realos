import { NextRequest, NextResponse } from "next/server";
import { recordCronRun } from "@/lib/health/cron-run";

// TODO(Sprint 10): rebuild weekly digest for tenants covering lead volume,
// chatbot conversations, pixel-identified visitors, and application pipeline.
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
  return recordCronRun("weekly-digest", async () => ({
    result: NextResponse.json({
      ok: true,
      stub: true,
      message: "weekly-digest stub, rewritten in Sprint 10",
    }),
    recordsProcessed: 0,
  }));
}
