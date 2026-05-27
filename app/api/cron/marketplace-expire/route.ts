import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { reapStaleLeads } from "@/lib/marketplace/expire";

// ---------------------------------------------------------------------------
// GET /api/cron/marketplace-expire
//
// Daily cron (07:00 UTC, see vercel.json). Flips MarketplaceLead rows past
// their expiresAt timestamp from AVAILABLE → EXPIRED. Soft-delete only —
// never hard-deletes, because purchases / audit / payouts reference leadId.
//
// Each expiration writes a MarketplaceAuditEvent so the lead's history
// (when + why it left the pool) is preserved forever.
//
// Auth: Bearer CRON_SECRET (verifyCronAuth).
// ---------------------------------------------------------------------------

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun<NextResponse>("marketplace-expire", async () => {
    const summary = await reapStaleLeads();
    return {
      result: NextResponse.json({ ok: true, ...summary }),
      recordsProcessed: summary.expiredCount,
    };
  });
}
