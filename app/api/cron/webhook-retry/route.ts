import { NextResponse } from "next/server";

// DECISION: Sprint 01 said "keep webhook-retry as-is, plumbing" but the real-estate
// schema (`prd/00-schema.prisma`) intentionally does not ship WebhookLog or
// WebhookEndpoint tables, so this cron is stubbed until tenant-level outbound
// webhooks are re-added. Re-enable when schema grows webhook models.
// TODO(v2): reintroduce outbound webhooks with per-tenant endpoints + retry log.
export async function GET() {
  return NextResponse.json({
    ok: true,
    stub: true,
    message: "webhook-retry stub, pending webhook schema in a future sprint",
  });
}
